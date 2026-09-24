import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { db } from './server/storage.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

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

app.post('/api/auth/register', (req: Request, res: Response) => {
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
    frais_livraison
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

  const user = db.createUser({
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
  });

  let restaurant = null;
  if (role === 'Restaurateur') {
    restaurant = db.createRestaurant({
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
      frais_livraison: Number(frais_livraison) || 2.50,
      frais_service: 0.90,
      couleur: '#FFF1E5',
      photo: '/src/assets/images/foodup_trattoria_pasta_1790144540478.jpg',
      disponible: true,
      statut_validation: 'En attente',
      horaires: '12:00 - 14:30 · 19:00 - 22:30'
    });

    // Add a default dish
    db.createDish({
      restaurant_id: restaurant.id,
      nom: 'Plat du jour maison',
      description: 'Préparé chaque matin par le chef selon arrivage du marché.',
      prix: 14.50,
      image_url: '/src/assets/images/foodup_trattoria_pasta_1790144540478.jpg',
      categorie: 'Plats',
      disponible: true
    });
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
  const restaurants = db.getRestaurants();
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

  const { restaurant_id, nom, description, prix, categorie, image_url, disponible } = req.body;
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
  });

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
    return res.json(db.getOrdersByRestaurant(restaurant.id));
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
    res.status(201).json(newOrder);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la création de la commande.' });
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

  // 1. Update order status -> 'En préparation'
  const updatedOrder = await db.updateOrderAsync(order.id, {
    statut: 'En préparation',
    temps_preparation_min: prepTime,
  });

  // 2. Strict idempotency: check if mission already exists for this order
  let existingMission = db.getMissionByOrder(order.id);
  if (!existingMission) {
    existingMission = await db.createMissionAsync({
      commande_id: order.id,
      restaurant_id: order.restaurant_id,
      statut: 'Disponible',
      remuneration_annoncee: Number((4.50 + (restaurant.frais_livraison * 0.4)).toFixed(2)),
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
app.post('/api/orders/:id/refuse', (req: Request, res: Response) => {
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

  const updatedOrder = db.updateOrder(order.id, {
    statut: 'Refusée',
    motif_refus: motif,
    paiement_simule: 'Annulé'
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

// Client cancels order (allowed only if 'En attente du restaurant')
app.post('/api/orders/:id/cancel', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: 'Non authentifié.' });

  const order = db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Commande introuvable.' });

  if (authUser.role === 'Client') {
    if (order.client_id !== authUser.id) {
      return res.status(403).json({ error: 'Action interdite sur cette commande.' });
    }
    if (order.statut !== 'En attente du restaurant') {
      return res.status(400).json({ 
        error: 'L’annulation directe n’est possible qu’avant acceptation du restaurant. Veuillez signaler un problème pour demander une annulation.' 
      });
    }
  }

  const updated = db.updateOrder(order.id, {
    statut: 'Annulée',
    paiement_simule: 'Annulé'
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
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  let gainsJour = 0;
  let gainsSemaine = 0;
  let gainsMois = 0;

  for (const m of missions) {
    const d = m.date_livraison ? new Date(m.date_livraison) : new Date();
    const amount = m.remuneration_annoncee || 0;
    if (d.toISOString().slice(0, 10) === todayStr) {
      gainsJour += amount;
    }
    if (d >= oneWeekAgo) {
      gainsSemaine += amount;
    }
    if (d >= oneMonthAgo) {
      gainsMois += amount;
    }
  }

  res.json({
    gainsJour: Number(gainsJour.toFixed(2)),
    gainsSemaine: Number(gainsSemaine.toFixed(2)),
    gainsMois: Number(gainsMois.toFixed(2)),
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
}

startServer();
