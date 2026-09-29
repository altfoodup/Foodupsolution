import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { db, FRAIS_LIVRAISON, FRAIS_SERVICE, calculerRemunerationLivreur } from './server/storage.js';
import {
  creerAutorisationCommande,
  capturerPaiement,
  annulerOuRembourser,
  verserAuxPartenaires,
  compteEstPret,
  creerCompteConnecte,
  creerSessionOnboarding,
  construireEvenementWebhook,
  statutPaiement,
} from './server/stripe.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Webhook Stripe : doit rester AVANT express.json() (corps brut nécessaire)
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  let event;
  try {
    event = construireEvenementWebhook(req.body as Buffer, req.headers['stripe-signature'] as string);
  } catch (err: any) {
    console.error('Webhook Stripe invalide :', err.message);
    return res.status(400).send('Signature invalide');
  }

  try {
    if (event.type === 'payment_intent.amount_capturable_updated') {
      const commandeId = event.data.object.metadata?.commande_id;
      const order = commandeId ? db.getOrderById(commandeId) : null;
      console.log(`Webhook Stripe reçu pour ${commandeId} — statut actuel : ${order?.statut ?? 'COMMANDE INTROUVABLE'}`);
      if (
        order &&
        (order.statut === 'En attente de paiement' ||
          (order.statut === 'En attente du restaurant' && order.paiement_statut !== 'Autorisé'))
      ) {
        await db.updateOrderAsync(order.id, {
          statut: 'En attente du restaurant',
          paiement_statut: 'Autorisé',
        });
        await db.createHistoryEventAsync({
          commande_id: order.id,
          acteur_id: order.client_id,
          action: 'PAIEMENT_AUTORISE',
          description: `Le paiement de la commande ${order.id} a été autorisé par la banque du client.`,
        });
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const commandeId = event.data.object.metadata?.commande_id;
      const order = commandeId ? db.getOrderById(commandeId) : null;
      if (order && order.statut === 'En attente de paiement') {
        await db.updateOrderAsync(order.id, { paiement_statut: 'Échec' });
      }
    }
  } catch (err: any) {
    console.error('Erreur traitement webhook Stripe :', err.message);
    return res.status(500).send('Erreur de traitement');
  }

  res.json({ received: true });
});

app.use(express.json());

// Helper to extract actor from request header
function getAuthUser(req: Request) {
  const userId = (req.headers['x-user-id'] as string) || '';
  if (!userId) return null;
  return db.getUserById(userId) || null;
}

// ==========================================
// 1. AUTH & PERSONAS
// ==========================================

app.get('/api/personas', (req: Request, res: Response) => {
  const users = db.getUsers().map(u => {
    let restaurantNom = undefined;
    let restaurantId = undefined;
    if (u.role === 'Restaurateur') {
      const rest = db.getRestaurantByOwnerId(u.id);
      if (rest) {
        restaurantNom = rest.nom;
        restaurantId = rest.id;
      }
    }
    return {
      ...u,
      restaurant_nom: restaurantNom,
      restaurant_id: restaurantId
    };
  });
  res.json(users);
});

app.post('/api/sync', async (req: Request, res: Response) => {
  await db.init();
  res.json({ success: true, message: 'Synchronisé avec Airtable avec succès' });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email requis' });
  }

  const user = db.getUserByEmail(email);
  if (!user) {
    return res.status(404).json({ error: `Aucun utilisateur trouvé avec l'email "${email}".` });
  }

  // If user is restaurateur, get their restaurant
  let restaurant = null;
  if (user.role === 'Restaurateur') {
    restaurant = db.getRestaurantByOwnerId(user.id);
  }

  res.json({
    user,
    restaurant
  });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: 'Non authentifié' });
  let restaurant = null;
  if (authUser.role === 'Restaurateur') {
    restaurant = db.getRestaurantByOwnerId(authUser.id);
  }
  res.json({ ...authUser, restaurant });
});

app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { 
    role, 
    prenom, 
    nom, 
    email, 
    telephone, 
    adresse, 
    code_postal, 
    ville, 
    instructions_livraison,
    // Courier specific
    moyen_deplacement,
    zone_livraison,
    // Restaurant specific
    nom_restaurant,
    cuisine,
    description_restaurant,
    quartier,
    delai,
    photo_url,          // lien photo du livreur
    photo_restaurant,   // lien photo du restaurant
    plats               // plats saisis à l'inscription
  } = req.body;

  if (!prenom || !nom || !email || !role) {
    return res.status(400).json({ error: 'Prénom, nom, email et rôle sont obligatoires.' });
  }

  const existing = db.getUserByEmail(email);
  if (existing) {
    return res.status(400).json({ error: 'Un compte existe déjà avec cette adresse email.' });
  }

  // Validation rules:
  // Client: 'Non requis'
  // Restaurateur: 'En attente'
  // Livreur: 'En attente'
  const statut_validation = role === 'Client' ? 'Non requis' : 'En attente';

  const user = await db.createUserAsync({
    prenom,
    nom,
    email,
    telephone: telephone || '',
    role,
    adresse: adresse || '',
    code_postal: code_postal || '',
    ville: ville || 'Paris',
    instructions_livraison: instructions_livraison || '',
    compte_actif: true,
    statut_validation,
    disponible_livraison: role === 'Livreur' ? false : undefined,
    moyen_deplacement: role === 'Livreur' ? (moyen_deplacement || 'Vélo') : undefined,
    zone_livraison: role === 'Livreur' ? (zone_livraison || 'Paris Centre') : undefined,
    photo_url: role === 'Livreur' ? (photo_url || undefined) : undefined,
  });

  let restaurant = null;
  if (role === 'Restaurateur') {
    restaurant = await db.createRestaurantAsync({
      nom: nom_restaurant || `Restaurant de ${prenom}`,
      proprietaire_id: user.id,
      cuisine: cuisine || 'Français',
      description: description_restaurant || 'Cuisine maison avec des produits frais du terroir.',
      adresse: adresse || '10 rue Oberkampf',
      code_postal: code_postal || '75011',
      ville: ville || 'Paris',
      quartier: quartier || 'Oberkampf',
      delai: delai || '20–30 min',
      delai_min: 25,
      frais_livraison: FRAIS_LIVRAISON,
      frais_service: FRAIS_SERVICE,
      couleur: '#FFF1E5',
      photo: (typeof photo_restaurant === 'string' && /^https?:\/\//.test(photo_restaurant.trim()))
        ? photo_restaurant.trim()
        : 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80',
      disponible: true,
      statut_validation: 'En attente',
      horaires: '12:00 - 14:30 · 19:00 - 22:30'
    });

    // Plats saisis par le restaurateur à l'inscription (plus de plat automatique)
    if (Array.isArray(plats)) {
      let platDuJourDejaChoisi = false;
      for (const p of plats) {
        if (!p || !p.nom || p.prix === undefined || p.prix === '') continue;
        const estPlatDuJour = !!p.plat_du_jour && !platDuJourDejaChoisi;
        if (estPlatDuJour) platDuJourDejaChoisi = true;
        db.createDish({
          restaurant_id: restaurant.id,
          nom: String(p.nom),
          description: String(p.description || ''),
          prix: Number(String(p.prix).replace(',', '.')) || 0,
          image_url: (typeof p.image_url === 'string' && /^https?:\/\//.test(p.image_url.trim()))
            ? p.image_url.trim()
            : restaurant.photo,
          categorie: p.categorie || 'Plats',
          disponible: true,
          plat_du_jour: estPlatDuJour
        });
      }
    }
  }

  // Audit event
  db.createHistoryEvent({
    acteur_id: user.id,
    action: 'INSCRIPTION_UTILISATEUR',
    description: `Nouvel utilisateur inscrit : ${prenom} ${nom} (${role}, validation: ${statut_validation}).`
  });

  res.status(201).json({ user, restaurant });
});

// ==========================================
// 2. RESTAURANTS & PLATS
// ==========================================

app.get('/api/restaurants', (req: Request, res: Response) => {
  // CORRECTION : le client ne voit que les restaurants validés par l'admin
  const restaurants = db.getRestaurants().filter(r => r.statut_validation === 'Accepté');
  res.json(restaurants);
});

app.get('/api/restaurants/:id', (req: Request, res: Response) => {
  const restaurant = db.getRestaurantById(req.params.id);
  if (!restaurant) {
    return res.status(404).json({ error: 'Restaurant introuvable.' });
  }
  const plats = db.getDishesByRestaurant(restaurant.id);
  res.json({ restaurant, plats });
});

app.get('/api/restaurants/:id/dishes', (req: Request, res: Response) => {
  const plats = db.getDishesByRestaurant(req.params.id);
  res.json(plats);
});

app.post('/api/dishes', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || (authUser.role !== 'Restaurateur' && authUser.role !== 'Administrateur')) {
    return res.status(403).json({ error: 'Action réservée aux restaurateurs.' });
  }

  const { restaurant_id, nom, description, prix, categorie, image_url, disponible, plat_du_jour } = req.body;
  if (!restaurant_id || !nom || prix === undefined) {
    return res.status(400).json({ error: 'Champs nom, prix et restaurant_id obligatoires.' });
  }

  // Check ownership
  const restaurant = db.getRestaurantById(restaurant_id);
  if (!restaurant) {
    return res.status(404).json({ error: 'Restaurant introuvable.' });
  }
  if (authUser.role === 'Restaurateur' && restaurant.proprietaire_id !== authUser.id) {
    return res.status(403).json({ error: 'Vous ne pouvez modifier que votre propre carte.' });
  }

  const dish = db.createDish({
    restaurant_id,
    nom,
    description: description || '',
    prix: Number(prix),
    image_url: image_url || restaurant.photo,
    categorie: categorie || 'Plats',
    disponible: disponible !== false,
    plat_du_jour: !!plat_du_jour,
  });

  // Un seul plat du jour par restaurant : on retire l'étiquette des autres
  if (plat_du_jour) {
    for (const other of db.getDishesByRestaurant(restaurant_id)) {
      if (other.id !== dish.id && other.plat_du_jour) db.updateDish(other.id, { plat_du_jour: false });
    }
  }

  db.createHistoryEvent({
    acteur_id: authUser.id,
    action: 'CREATION_PLAT',
    description: `${authUser.prenom} a ajouté le plat "${dish.nom}" (${dish.prix.toFixed(2)} €) au menu de ${restaurant.nom}.`
  });

  res.status(201).json(dish);
});

app.put('/api/dishes/:id', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || (authUser.role !== 'Restaurateur' && authUser.role !== 'Administrateur')) {
    return res.status(403).json({ error: 'Action non autorisée.' });
  }

  const dish = db.getDishById(req.params.id);
  if (!dish) {
    return res.status(404).json({ error: 'Plat introuvable.' });
  }

  const restaurant = db.getRestaurantById(dish.restaurant_id);
  if (authUser.role === 'Restaurateur' && restaurant?.proprietaire_id !== authUser.id) {
    return res.status(403).json({ error: 'Vous ne pouvez modifier que les plats de votre restaurant.' });
  }

  const updated = db.updateDish(dish.id, req.body);

  // Un seul plat du jour par restaurant : on retire l'étiquette des autres
  if (req.body.plat_du_jour) {
    for (const other of db.getDishesByRestaurant(dish.restaurant_id)) {
      if (other.id !== dish.id && other.plat_du_jour) db.updateDish(other.id, { plat_du_jour: false });
    }
  }
  res.json(updated);
});

// ==========================================
// 3. COMMANDES (ORDERS)
// ==========================================

app.get('/api/orders', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Non authentifié.' });
  }

  if (authUser.role === 'Client') {
    return res.json(db.getOrdersByClient(authUser.id));
  }

  if (authUser.role === 'Restaurateur') {
    const restaurant = db.getRestaurantByOwnerId(authUser.id);
    if (!restaurant) {
      return res.json([]);
    }
    // Strictly isolate orders to the owner's restaurant
    // (les commandes non encore payées ne sont pas visibles du restaurateur)
    return res.json(
      db.getOrdersByRestaurant(restaurant.id).filter(o => o.statut !== 'En attente de paiement')
    );
  }

  if (authUser.role === 'Livreur') {
    // Deliveries assigned to this courier or currently active
    const missions = db.getMissionsByCourier(authUser.id);
    const orderIds = new Set(missions.map(m => m.commande_id));
    const orders = db.getOrders().filter(o => orderIds.has(o.id));
    return res.json(orders);
  }

  if (authUser.role === 'Administrateur') {
    return res.json(db.getOrders());
  }

  res.json([]);
});

app.get('/api/orders/:id', (req: Request, res: Response) => {
  const order = db.getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Commande introuvable.' });
  }

  const authUser = getAuthUser(req);
  if (authUser) {
    // Permission checks
    if (authUser.role === 'Client' && order.client_id !== authUser.id) {
      return res.status(403).json({ error: 'Accès non autorisé à cette commande.' });
    }
    if (authUser.role === 'Restaurateur') {
      const rest = db.getRestaurantById(order.restaurant_id);
      if (rest?.proprietaire_id !== authUser.id) {
        return res.status(403).json({ error: 'Cette commande ne concerne pas votre restaurant.' });
      }
    }
  }

  res.json(order);
});

app.post('/api/orders', async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'Client') {
    return res.status(403).json({ error: 'Seul un client authentifié peut passer commande.' });
  }

  const { restaurant_id, adresse_livraison, instructions_livraison, items } = req.body;

  try {
    const newOrder = await db.createOrderWithLinesAsync({
      client_id: authUser.id,
      restaurant_id,
      adresse_livraison: adresse_livraison || authUser.adresse,
      instructions_livraison: instructions_livraison || authUser.instructions_livraison,
      items
    });

    // Sans clé Stripe configurée (Render) : ancien fonctionnement, paiement simulé
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(201).json(newOrder);
    }

    // Autorisation de carte (le débit réel a lieu quand le restaurateur accepte)
    const { paymentIntentId, clientSecret } = await creerAutorisationCommande({
      commandeId: newOrder.id,
      montantTotal: newOrder.total,
      emailClient: authUser.email,
    });

    await db.updateOrderAsync(newOrder.id, {
      statut: 'En attente de paiement',
      paiement_statut: 'Non payé',
      stripe_payment_intent_id: paymentIntentId,
    });

    res.status(201).json({ ...db.getOrderById(newOrder.id), client_secret: clientSecret });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la création de la commande.' });
  }
});

// Le client confirme son paiement : on vérifie auprès de Stripe (filet de sécurité si le webhook tarde)
app.post('/api/orders/:id/confirm-payment', async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'Client') {
    return res.status(403).json({ error: 'Action réservée au client.' });
  }

  const order = db.getOrderById(req.params.id);
  if (!order || order.client_id !== authUser.id) {
    return res.status(404).json({ error: 'Commande introuvable.' });
  }

  try {
    if (order.statut === 'En attente de paiement' && order.stripe_payment_intent_id) {
      const statut = await statutPaiement(order.stripe_payment_intent_id);
      if (statut === 'requires_capture') {
        await db.updateOrderAsync(order.id, {
          statut: 'En attente du restaurant',
          paiement_statut: 'Autorisé',
        });
        await db.createHistoryEventAsync({
          commande_id: order.id,
          acteur_id: order.client_id,
          action: 'PAIEMENT_AUTORISE',
          description: `Le paiement de la commande ${order.id} a été autorisé par la banque du client.`,
        });
      }
    }
    res.json(db.getOrderById(order.id));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur Stripe.' });
  }
});

// Restaurateur accepts order -> Transitions to 'En préparation' + creates 1 Mission 'Disponible'
app.post('/api/orders/:id/accept', async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'Restaurateur') {
    return res.status(403).json({ error: 'Action réservée au restaurateur.' });
  }

  const order = db.getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Commande introuvable.' });
  }

  const restaurant = db.getRestaurantById(order.restaurant_id);
  if (!restaurant || restaurant.proprietaire_id !== authUser.id) {
    return res.status(403).json({ error: 'Vous n’êtes pas le propriétaire de ce restaurant.' });
  }

  if (order.statut !== 'En attente du restaurant') {
    return res.status(400).json({ error: `Transition illégale : la commande est actuellement "${order.statut}".` });
  }

  const prepTime = Number(req.body.temps_preparation_min) || 20;

  // 0. Encaissement Stripe (les anciennes commandes sans paiement Stripe passent sans encaissement)
  let chargeId: string | null = null;
  if (order.stripe_payment_intent_id) {
    try {
      const capture = await capturerPaiement(order.stripe_payment_intent_id);
      chargeId = capture.chargeId;
    } catch (err: any) {
      return res.status(402).json({ error: `Le paiement n'a pas pu être encaissé : ${err.message}` });
    }
  }

  // 1. Update order status -> 'En préparation'
  const updatedOrder = await db.updateOrderAsync(order.id, {
    statut: 'En préparation',
    temps_preparation_min: prepTime,
    ...(chargeId ? { paiement_statut: 'Payé', stripe_charge_id: chargeId } : {}),
  });

  // 2. Strict idempotency: check if mission already exists for this order
  let existingMission = db.getMissionByOrder(order.id);
  if (!existingMission) {
    existingMission = await db.createMissionAsync({
      commande_id: order.id,
      restaurant_id: order.restaurant_id,
      statut: 'Disponible',
      // Rémunération du livreur : 3 € + 10 % du total de la commande
      remuneration_annoncee: calculerRemunerationLivreur(order.frais_livraison),
    });
  }

  await db.createHistoryEventAsync({
    commande_id: order.id,
    acteur_id: authUser.id,
    action: 'ACCEPTATION_RESTAURANT',
    description: `${authUser.prenom} ${authUser.nom} (${restaurant.nom}) a accepté la commande ${order.id} (durée estimée : ${prepTime} min).`
  });

  res.json(updatedOrder);
});

// Restaurateur refuses order -> 'Refusée'
app.post('/api/orders/:id/refuse', async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'Restaurateur') {
    return res.status(403).json({ error: 'Action réservée au restaurateur.' });
  }

  const order = db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Commande introuvable.' });

  const restaurant = db.getRestaurantById(order.restaurant_id);
  if (!restaurant || restaurant.proprietaire_id !== authUser.id) {
    return res.status(403).json({ error: 'Action non autorisée.' });
  }

  const motif = req.body.motif;
  if (!motif || !motif.trim()) {
    return res.status(400).json({ error: 'Le motif de refus est obligatoire.' });
  }

  let paiementStatut = 'Annulé';
  if (order.stripe_payment_intent_id) {
    try {
      const r = await annulerOuRembourser(order.stripe_payment_intent_id);
      if (r.action === 'rembourse') paiementStatut = 'Remboursé';
    } catch (err: any) {
      return res.status(502).json({ error: `Annulation du paiement impossible : ${err.message}` });
    }
  }

  const updatedOrder = await db.updateOrderAsync(order.id, {
    statut: 'Refusée',
    motif_refus: motif,
    paiement_simule: 'Annulé',
    paiement_statut: paiementStatut,
  });

  db.createHistoryEvent({
    commande_id: order.id,
    acteur_id: authUser.id,
    action: 'REFUS_RESTAURANT',
    description: `${restaurant.nom} a refusé la commande ${order.id}. Motif : ${motif}.`
  });

  res.json(updatedOrder);
});

// Restaurateur marks order ready -> 'Prête'
app.post('/api/orders/:id/ready', async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'Restaurateur') {
    return res.status(403).json({ error: 'Action réservée au restaurateur.' });
  }

  const order = db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Commande introuvable.' });

  const restaurant = db.getRestaurantById(order.restaurant_id);
  if (!restaurant || restaurant.proprietaire_id !== authUser.id) {
    return res.status(403).json({ error: 'Action non autorisée.' });
  }

  if (order.statut !== 'En préparation') {
    return res.status(400).json({ error: `La commande doit être "En préparation" pour être marquée prête (statut actuel: ${order.statut}).` });
  }

  const updatedOrder = await db.updateOrderAsync(order.id, {
    statut: 'Prête'
  });

  await db.createHistoryEventAsync({
    commande_id: order.id,
    acteur_id: authUser.id,
    action: 'COMMANDE_PRETE',
    description: `${restaurant.nom} a signalé la commande ${order.id} prête pour le retrait.`
  });

  res.json(updatedOrder);
});

// Client cancels order (allowed only before the restaurant accepts)
app.post('/api/orders/:id/cancel', async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: 'Non authentifié.' });

  const order = db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Commande introuvable.' });

  if (authUser.role === 'Client') {
    if (order.client_id !== authUser.id) {
      return res.status(403).json({ error: 'Action interdite sur cette commande.' });
    }
    if (order.statut !== 'En attente du restaurant' && order.statut !== 'En attente de paiement') {
      return res.status(400).json({ 
        error: 'L’annulation directe n’est possible qu’avant acceptation du restaurant. Veuillez signaler un problème pour demander une annulation.' 
      });
    }
  }

  let paiementStatut = 'Annulé';
  if (order.stripe_payment_intent_id) {
    try {
      const r = await annulerOuRembourser(order.stripe_payment_intent_id);
      if (r.action === 'rembourse') paiementStatut = 'Remboursé';
    } catch (err: any) {
      return res.status(502).json({ error: `Annulation du paiement impossible : ${err.message}` });
    }
  }

  const updated = await db.updateOrderAsync(order.id, {
    statut: 'Annulée',
    paiement_simule: 'Annulé',
    paiement_statut: paiementStatut,
  });

  // Cancel associated mission if any
  const mission = db.getMissionByOrder(order.id);
  if (mission && mission.statut === 'Disponible') {
    db.updateDeliveryMission(mission.id, { statut: 'Annulée' });
  }

  db.createHistoryEvent({
    commande_id: order.id,
    acteur_id: authUser.id,
    action: 'ANNULATION_COMMANDE',
    description: `La commande ${order.id} a été annulée par ${authUser.prenom} ${authUser.nom}.`
  });

  res.json(updated);
});

// ==========================================
// 4. MISSIONS LIVRAISON (COURIER)
// ==========================================

app.get('/api/missions/available', async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'Livreur') {
    return res.status(403).json({ error: 'Action réservée aux livreurs.' });
  }

  const isValidationAccepted = authUser.statut_validation === 'Accepté' || authUser.statut_validation === 'Validé';
  if (!authUser.compte_actif || !isValidationAccepted) {
    return res.status(403).json({ error: 'Votre compte livreur doit être actif et validé pour recevoir des missions.' });
  }

  if (!authUser.disponible_livraison) {
    return res.json([]);
  }

  const missions = await db.getAvailableMissionsAsync();
  res.json(missions);
});

app.get('/api/missions/active', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'Livreur') {
    return res.status(403).json({ error: 'Action réservée aux livreurs.' });
  }

  const courierMissions = db.getMissionsByCourier(authUser.id);
  // Find currently active mission (Attribuée or En cours) whose order is not yet finished
  const activeMission = courierMissions.find(m => {
    if (m.statut !== 'Attribuée' && m.statut !== 'En cours') return false;
    const order = db.getOrderById(m.commande_id);
    if (order && (order.statut === 'Livrée' || order.statut === 'Annulée' || order.statut === 'Refusée')) {
      return false;
    }
    return true;
  });

  res.json(activeMission || null);
});

app.post('/api/missions/:id/accept', async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'Livreur') {
    return res.status(403).json({ error: 'Action réservée aux livreurs.' });
  }

  const isValidationAccepted = authUser.statut_validation === 'Accepté' || authUser.statut_validation === 'Validé';
  if (!authUser.compte_actif || !isValidationAccepted || !authUser.disponible_livraison) {
    return res.status(400).json({ error: 'Vous devez être actif, validé et disponible pour accepter une mission.' });
  }

  // Check if courier already has an ongoing active course
  const activeExisting = db.getMissionsByCourier(authUser.id).find(m => {
    if (m.statut !== 'Attribuée' && m.statut !== 'En cours') return false;
    const order = db.getOrderById(m.commande_id);
    return !order || (order.statut !== 'Livrée' && order.statut !== 'Annulée' && order.statut !== 'Refusée');
  });
  if (activeExisting) {
    return res.status(400).json({ error: 'Vous avez déjà une course en cours.' });
  }

  // 1. Relire la mission
  const mission = db.getMissionById(req.params.id);
  if (!mission) {
    return res.status(404).json({ error: 'Mission introuvable.' });
  }

  // 2. Vérifier Statut = "Disponible"
  if (mission.statut !== 'Disponible') {
    return res.status(409).json({ error: 'Cette mission vient d’être prise par un autre livreur.' });
  }

  // 3. Vérifier que Livreur est vide
  if (mission.livreur_id) {
    return res.status(409).json({ error: 'Cette mission est déjà attribuée à un livreur.' });
  }

  // 7, 8, 9. Enregistrer le livreur connecté, Mission.Statut = "Attribuée", Date_attribution = maintenant
  const now = new Date().toISOString();
  const updatedMission = await db.updateDeliveryMissionAsync(mission.id, {
    statut: 'Attribuée',
    livreur_id: authUser.id,
    date_attribution: now,
  });

  // Mettre à jour la commande locale pour refléter l'attribution immédiatement
  db.updateOrder(mission.commande_id, {
    livreur_id: authUser.id
  });

  // 10. Écrire Historique_actions
  await db.createHistoryEventAsync({
    commande_id: mission.commande_id,
    mission_id: mission.id,
    acteur_id: authUser.id,
    action: 'ACCEPTATION_LIVREUR',
    description: `${authUser.prenom} ${authUser.nom} a accepté la mission ${mission.id} pour la commande ${mission.commande_id}.`
  });

  // 11. Relire la mission et la renvoyer
  res.json(updatedMission);
});

// Courier picks up order -> Mission 'En cours', Order 'En livraison'
app.post('/api/missions/:id/pickup', async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'Livreur') {
    return res.status(403).json({ error: 'Action réservée aux livreurs.' });
  }

  const mission = db.getMissionById(req.params.id);
  if (!mission || mission.livreur_id !== authUser.id) {
    return res.status(403).json({ error: 'Vous n’êtes pas le livreur assigné à cette mission.' });
  }

  if (mission.statut !== 'Attribuée') {
    return res.status(400).json({ error: `Statut de mission invalide (${mission.statut}).` });
  }

  const order = db.getOrderById(mission.commande_id);
  if (!order) return res.status(404).json({ error: 'Commande introuvable.' });

  if (order.statut !== 'Prête') {
    return res.status(400).json({ error: 'La commande n’est pas encore prête au restaurant.' });
  }

  const now = new Date().toISOString();
  const updatedMission = await db.updateDeliveryMissionAsync(mission.id, {
    statut: 'En cours',
    date_retrait: now
  });

  await db.updateOrderAsync(order.id, {
    statut: 'En livraison'
  });

  await db.createHistoryEventAsync({
    commande_id: order.id,
    mission_id: mission.id,
    acteur_id: authUser.id,
    action: 'RETRAIT_COMMANDE',
    description: `${authUser.prenom} ${authUser.nom} a récupéré la commande ${order.id} au restaurant. En route pour livraison.`
  });

  res.json(updatedMission);
});

// Courier completes delivery -> Mission 'Terminée', Order 'Livrée'
app.post('/api/missions/:id/deliver', async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'Livreur') {
    return res.status(403).json({ error: 'Action réservée aux livreurs.' });
  }

  const mission = db.getMissionById(req.params.id);
  if (!mission || mission.livreur_id !== authUser.id) {
    return res.status(403).json({ error: 'Action non autorisée.' });
  }

  if (mission.statut !== 'En cours') {
    return res.status(400).json({ error: `La mission doit être "En cours" (statut actuel: ${mission.statut}).` });
  }

  const now = new Date().toISOString();
  const updatedMission = await db.updateDeliveryMissionAsync(mission.id, {
    statut: 'Terminée',
    date_livraison: now
  });

  await db.updateOrderAsync(mission.commande_id, {
    statut: 'Livrée'
  });

  // --- Virements Stripe vers le restaurateur et le livreur ---
  const commande = db.getOrderById(mission.commande_id);
  if (commande?.stripe_charge_id && !commande.stripe_transfer_restaurateur_id) {
    try {
      const restaurantCmd = db.getRestaurantById(commande.restaurant_id);
      const proprio = restaurantCmd ? db.getUserById(restaurantCmd.proprietaire_id) : null;

      const fraisService = Number((commande as any).frais_service ?? FRAIS_SERVICE);
      const montantLivreur = Number(mission.remuneration_annoncee) || 0;
      // À VÉRIFIER avec vos totaux : restaurateur = total - frais de livraison - frais de service
      const montantResto = Math.max(0, Number((commande.total - commande.frais_livraison - fraisService).toFixed(2)));
      const commission = Number((commande.total - montantResto - montantLivreur).toFixed(2));

      if (commission < 0) throw new Error('Montants incohérents (commission négative).');
      if (!proprio?.stripe_account_id || !authUser.stripe_account_id) {
        throw new Error('Compte Stripe manquant pour le restaurateur ou le livreur.');
      }
      if (!(await compteEstPret(proprio.stripe_account_id)) || !(await compteEstPret(authUser.stripe_account_id))) {
        throw new Error('Un des comptes Stripe n’a pas terminé son inscription.');
      }

      const v = await verserAuxPartenaires({
        commandeId: commande.id,
        chargeId: commande.stripe_charge_id,
        restaurateur: { accountId: proprio.stripe_account_id, montant: montantResto },
        livreur: montantLivreur > 0
          ? { accountId: authUser.stripe_account_id, montant: montantLivreur }
          : undefined,
      });

      await db.updateOrderAsync(commande.id, {
        stripe_transfer_restaurateur_id: v.transferRestaurateurId,
        stripe_transfer_livreur_id: v.transferLivreurId ?? '',
        montant_restaurateur: montantResto,
        commission_plateforme: commission,
      });

      await db.createHistoryEventAsync({
        commande_id: commande.id,
        acteur_id: authUser.id,
        action: 'VIREMENTS_STRIPE',
        description: `Virements effectués : restaurateur ${montantResto.toFixed(2)} €, livreur ${montantLivreur.toFixed(2)} €, commission ${commission.toFixed(2)} €.`
      });
    } catch (err: any) {
      // La livraison reste valide ; le virement pourra être refait
      console.error('Virements Stripe en échec :', err.message);
      await db.createHistoryEventAsync({
        commande_id: commande.id,
        acteur_id: authUser.id,
        action: 'VIREMENTS_STRIPE_ECHEC',
        description: `Virements non effectués : ${err.message}`
      });
    }
  }

  await db.createHistoryEventAsync({
    commande_id: mission.commande_id,
    mission_id: mission.id,
    acteur_id: authUser.id,
    action: 'COMMANDE_LIVREE',
    description: `${authUser.prenom} ${authUser.nom} a confirmé la livraison de la commande ${mission.commande_id} au client.`
  });

  res.json(updatedMission);
});

// Courier availability toggle: ONLY touches disponible_livraison, NEVER compte_actif
app.post('/api/courier/availability', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'Livreur') {
    return res.status(403).json({ error: 'Réservé aux livreurs.' });
  }

  const { disponible } = req.body;
  const updated = db.updateUser(authUser.id, {
    disponible_livraison: Boolean(disponible)
  });

  res.json(updated);
});

// Courier earnings summary
app.get('/api/courier/earnings', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'Livreur') {
    return res.status(403).json({ error: 'Réservé aux livreurs.' });
  }

  const missions = db.getMissionsByCourier(authUser.id).filter(m => m.statut === 'Terminée');
  // Dates comparées à l'heure de Paris (AAAA-MM-JJ)
  const jourParis = (d: Date) => d.toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
  const now = new Date();
  const aujourdhui = jourParis(now);
  const moisEnCours = aujourdhui.slice(0, 7);
  const anneeEnCours = aujourdhui.slice(0, 4);
  // 7 derniers jours = aujourd'hui + les 6 jours précédents
  const debut7Jours = jourParis(new Date(now.getTime() - 6 * 24 * 3600 * 1000));

  let gainsJour = 0, gainsSemaine = 0, gainsMois = 0, gainsAnnee = 0;
  let coursesJour = 0, coursesSemaine = 0, coursesMois = 0, coursesAnnee = 0;

  for (const m of missions) {
    const amount = Number(m.remuneration_annoncee) || 0;
    // Date de référence : date de livraison ; sinon date de la commande (jamais « aujourd'hui » par défaut)
    const order = db.getOrderById(m.commande_id);
    const dateRef = m.date_livraison || order?.mise_a_jour_a || order?.cree_a;
    if (!dateRef) continue;
    const d = new Date(dateRef);
    if (isNaN(d.getTime())) continue;
    const jour = jourParis(d);

    if (jour === aujourdhui) { gainsJour += amount; coursesJour++; }
    if (jour >= debut7Jours && jour <= aujourdhui) { gainsSemaine += amount; coursesSemaine++; }
    if (jour.slice(0, 7) === moisEnCours) { gainsMois += amount; coursesMois++; }
    if (jour.slice(0, 4) === anneeEnCours) { gainsAnnee += amount; coursesAnnee++; }
  }

  res.json({
    gainsJour: Number(gainsJour.toFixed(2)),
    gainsSemaine: Number(gainsSemaine.toFixed(2)),
    gainsMois: Number(gainsMois.toFixed(2)),
    gainsAnnee: Number(gainsAnnee.toFixed(2)),
    coursesJour,
    coursesSemaine,
    coursesMois,
    coursesAnnee,
    nombreMissionsTerminees: missions.length
  });
});

// ==========================================
// 5. SIGNALEMENTS (REPORTS / INCIDENTS)
// ==========================================

app.get('/api/reports', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: 'Non authentifié.' });

  if (authUser.role === 'Administrateur') {
    return res.json(db.getReports());
  }

  // Regular user sees their own reports
  const all = db.getReports().filter(r => r.auteur_id === authUser.id);
  res.json(all);
});

app.post('/api/reports', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: 'Non authentifié.' });

  const { commande_id, type, description } = req.body;
  if (!commande_id || !type || !description) {
    return res.status(400).json({ error: 'Commande, type et description obligatoires.' });
  }

  const order = db.getOrderById(commande_id);
  if (!order) return res.status(404).json({ error: 'Commande introuvable.' });

  const report = db.createReport({
    commande_id,
    auteur_id: authUser.id,
    type,
    description
  });

  res.status(201).json(report);
});

app.post('/api/reports/:id/resolve', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'Administrateur') {
    return res.status(403).json({ error: 'Action réservée aux administrateurs.' });
  }

  const { reponse_admin } = req.body;
  const updated = db.updateReport(req.params.id, {
    statut: 'Résolu',
    reponse_admin: reponse_admin || 'Incident traité par l’administrateur.',
    resolu_par: authUser.id
  });

  if (!updated) return res.status(404).json({ error: 'Signalement introuvable.' });

  db.createHistoryEvent({
    commande_id: updated.commande_id,
    acteur_id: authUser.id,
    action: 'RESOLUTION_SIGNALEMENT',
    description: `Claire Dubois a résolu le signalement ${updated.id}. Réponse : "${updated.reponse_admin}".`
  });

  res.json(updated);
});

// ==========================================
// STRIPE CONNECT (restaurateurs et livreurs)
// ==========================================

app.post('/api/stripe/connect/session', async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || (authUser.role !== 'Restaurateur' && authUser.role !== 'Livreur')) {
    return res.status(403).json({ error: 'Réservé aux restaurateurs et livreurs.' });
  }
  try {
    let accountId = authUser.stripe_account_id;
    if (!accountId) {
      accountId = await creerCompteConnecte({
        email: authUser.email,
        nom: `${authUser.prenom} ${authUser.nom}`,
      });
      db.updateUser(authUser.id, { stripe_account_id: accountId });
    }
    const clientSecret = await creerSessionOnboarding(accountId);
    res.json({ client_secret: clientSecret });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur Stripe.' });
  }
});

app.post('/api/stripe/connect/status', async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: 'Non authentifié.' });
  if (!authUser.stripe_account_id) return res.json({ pret: false });
  try {
    const pret = await compteEstPret(authUser.stripe_account_id);
    db.updateUser(authUser.id, { stripe_pret: pret });
    res.json({ pret });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur Stripe.' });
  }
});

// ==========================================
// 6. ADMINISTRATEUR
// ==========================================

app.get('/api/admin/dashboard', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'Administrateur') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
  }

  const orders = db.getOrders();
  const missions = db.getDeliveryMissions();
  const reports = db.getReports();
  const users = db.getUsers();

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const currentYearMonth = now.toISOString().slice(0, 7);

  // Commandes en cours: active non-final statuses
  const inProgressStatuses = ['En attente du restaurant', 'En préparation', 'Prête', 'En livraison'];
  const commandesEnCours = orders.filter(o => inProgressStatuses.includes(o.statut)).length;

  // Incidents à traiter: Nouveau ou En cours
  const incidentsATraiter = reports.filter(r => r.statut !== 'Résolu').length;

  // Delivered orders
  const deliveredOrders = orders.filter(o => o.statut === 'Livrée');
  
  // Today's delivered orders
  const deliveredToday = deliveredOrders.filter(o => o.cree_a.slice(0, 10) === todayStr);
  const livraisonsAujourdhui = deliveredToday.length;
  const caJour = deliveredToday.reduce((sum, o) => sum + o.total, 0);

  // Month's delivered orders
  const deliveredMonth = deliveredOrders.filter(o => o.cree_a.slice(0, 7) === currentYearMonth);
  const commandesMois = deliveredMonth.length;
  const caMois = deliveredMonth.reduce((sum, o) => sum + o.total, 0);

  // Panier moyen
  const panierMoyen = deliveredOrders.length > 0 
    ? (deliveredOrders.reduce((sum, o) => sum + o.total, 0) / deliveredOrders.length) 
    : 0;

  // Active couriers
  const livreursActifs = users.filter(u => u.role === 'Livreur' && u.compte_actif && u.disponible_livraison).length;

  res.json({
    kpi: {
      commandesEnCours,
      incidentsATraiter,
      livraisonsAujourdhui,
      caJour: Number(caJour.toFixed(2)),
      caMois: Number(caMois.toFixed(2)),
      commandesMois,
      panierMoyen: Number(panierMoyen.toFixed(2)),
      livreursActifs
    },
    incidentsRecents: reports.slice(0, 5),
    commandesEnCoursList: orders.filter(o => inProgressStatuses.includes(o.statut)).slice(0, 6)
  });
});

app.post('/api/admin/partners/:id/validate', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'Administrateur') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
  }

  const { decision, motif } = req.body;
  if (decision !== 'Accepté' && decision !== 'Refusé') {
    return res.status(400).json({ error: 'Décision invalide (doit être "Accepté" ou "Refusé").' });
  }

  if (decision === 'Refusé' && (!motif || !motif.trim())) {
    return res.status(400).json({ error: 'Un motif est obligatoire en cas de refus.' });
  }

  const targetUser = db.getUserById(req.params.id);
  if (!targetUser) return res.status(404).json({ error: 'Partenaire introuvable.' });

  const updatedUser = db.updateUser(targetUser.id, {
    statut_validation: decision,
    motif_decision: motif || '',
    valide_par: authUser.id,
    date_decision: new Date().toISOString()
  });

  // If partner is a restaurateur, also update restaurant validation
  if (targetUser.role === 'Restaurateur') {
    const rest = db.getRestaurantByOwnerId(targetUser.id);
    if (rest) {
      db.updateRestaurant(rest.id, {
        statut_validation: decision
      });
    }
  }

  db.createHistoryEvent({
    acteur_id: authUser.id,
    action: decision === 'Accepté' ? 'VALIDATION_PARTENAIRE' : 'REFUS_PARTENAIRE',
    description: `Claire Dubois a ${decision === 'Accepté' ? 'accepté' : 'refusé'} le dossier de ${targetUser.prenom} ${targetUser.nom} (${targetUser.role}). ${motif ? `Motif : ${motif}` : ''}`
  });

  res.json(updatedUser);
});

// Platform activity log
app.get('/api/history', (req: Request, res: Response) => {
  res.json(db.getHistory());
});

// Diagnostic check endpoint (internal development test for Airtable connection)
app.get('/api/dev/airtable-status', async (req: Request, res: Response) => {
  const result = await db.checkAirtableConnection();
  res.json(result);
});

// ==========================================
// VITE SETUP & STATIC SERVING
// ==========================================

async function startServer() {
  await db.init();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FoodUp server running on port ${PORT}`);
  });

  // Recharge automatiquement les données Airtable toutes les 60 secondes
  setInterval(() => {
    db.init();
  }, 60 * 1000);
}

startServer();
