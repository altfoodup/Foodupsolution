import { 
  Utilisateur, 
  Restaurant, 
  Plat, 
  Commande, 
  LigneCommande, 
  MissionLivraison, 
  Signalement, 
  HistoriqueAction 
} from '../src/types.js';

interface DatabaseSchema {
  utilisateurs: (Utilisateur & { airtableRecordId?: string })[];
  restaurants: (Restaurant & { airtableRecordId?: string; note?: number; nb_avis?: number })[];
  plats: (Plat & { airtableRecordId?: string })[];
  commandes: (Commande & { airtableRecordId?: string })[];
  lignes_commande: (LigneCommande & { airtableRecordId?: string })[];
  missions_livraison: (MissionLivraison & { airtableRecordId?: string })[];
  signalements: (Signalement & { airtableRecordId?: string })[];
  historique_actions: (HistoriqueAction & { airtableRecordId?: string })[];
}

export class DataStore {
  private data: DatabaseSchema = {
    utilisateurs: [],
    restaurants: [],
    plats: [],
    commandes: [],
    lignes_commande: [],
    missions_livraison: [],
    signalements: [],
    historique_actions: []
  };

  private airtablePat: string;
  private airtableBaseId: string;
  private isInitialized = false;

  constructor() {
    this.airtablePat = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || process.env.AIRTABLE_API_KEY || '';
    this.airtableBaseId = process.env.AIRTABLE_BASE_ID || '';
  }

  // --- Airtable HTTP Helpers ---
  private async airtableFetchAll(tableName: string): Promise<any[]> {
    if (!this.airtablePat || !this.airtableBaseId) return [];
    const records: any[] = [];
    let offset: string | undefined = undefined;

    do {
      let url = `https://api.airtable.com/v0/${this.airtableBaseId}/${encodeURIComponent(tableName)}`;
      if (offset) url += `?offset=${offset}`;

      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${this.airtablePat}` }
        });
        if (!res.ok) {
          console.error(`Airtable fetchAll error on ${tableName}:`, res.status, await res.text());
          break;
        }
        const data = await res.json();
        if (data.records) {
          records.push(...data.records);
        }
        offset = data.offset;
      } catch (err) {
        console.error(`Airtable fetchAll network error on ${tableName}:`, err);
        break;
      }
    } while (offset);

    return records;
  }

  private async airtablePost(tableName: string, fields: Record<string, any>): Promise<any | null> {
    if (!this.airtablePat || !this.airtableBaseId) return null;
    const url = `https://api.airtable.com/v0/${this.airtableBaseId}/${encodeURIComponent(tableName)}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.airtablePat}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields, typecast: true })
      });
      if (!res.ok) {
        console.error(`Airtable POST error on ${tableName}:`, res.status, await res.text());
        return null;
      }
      return await res.json();
    } catch (err) {
      console.error(`Airtable POST network error on ${tableName}:`, err);
      return null;
    }
  }

  private async airtablePatch(tableName: string, recordId: string, fields: Record<string, any>): Promise<any | null> {
    if (!this.airtablePat || !this.airtableBaseId) return null;
    const url = `https://api.airtable.com/v0/${this.airtableBaseId}/${encodeURIComponent(tableName)}/${recordId}`;
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.airtablePat}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields, typecast: true })
      });
      if (!res.ok) {
        console.error(`Airtable PATCH error on ${tableName}:`, res.status, await res.text());
        return null;
      }
      return await res.json();
    } catch (err) {
      console.error(`Airtable PATCH network error on ${tableName}:`, err);
      return null;
    }
  }

  // --- Initial Data Load from Airtable ---
  async init(): Promise<void> {
    console.log('🔄 Initializing FoodUp DataStore directly from Airtable...');
    const t0 = Date.now();

    try {
      const [
        usersRecs,
        restsRecs,
        platsRecs,
        cmdsRecs,
        lignesRecs,
        missionsRecs,
        sigsRecs,
        actionsRecs
      ] = await Promise.all([
        this.airtableFetchAll('Utilisateurs'),
        this.airtableFetchAll('Restaurants'),
        this.airtableFetchAll('Plats'),
        this.airtableFetchAll('Commandes'),
        this.airtableFetchAll('Lignes_commande'),
        this.airtableFetchAll('Missions_livraison'),
        this.airtableFetchAll('Signalements'),
        this.airtableFetchAll('Historique_actions')
      ]);
 if (usersRecs.length === 0 && restsRecs.length === 0) {
        console.warn('⚠️ Airtable n’a renvoyé aucune donnée, rechargement ignoré.');
        return;
      }
      
      // 1. Build lookup maps for Airtable record IDs <-> Business IDs
      const userAirtableIdMap = new Map<string, string>(); // airtableId -> USR-xxx
      const userBusinessIdMap = new Map<string, string>(); // USR-xxx -> airtableId
      const userEmailMap = new Map<string, string>(); // email.toLowerCase() -> USR-xxx

      const users: (Utilisateur & { airtableRecordId: string })[] = usersRecs.map(r => {
        const uid = r.fields.utilisateur_id || `USR-${r.id}`;
        userAirtableIdMap.set(r.id, uid);
        userBusinessIdMap.set(uid, r.id);
        if (r.fields.email) userEmailMap.set(String(r.fields.email).trim().toLowerCase(), uid);

        const role = (r.fields.role as any) || 'Client';
        const isClient = role === 'Client';
        // CORRECTION : on lit le vrai statut, et on traite "Validé" comme "Accepté"
        const rawStatut = r.fields.statut_validation === 'Validé' ? 'Accepté' : r.fields.statut_validation;

        return {
          id: uid,
          airtableRecordId: r.id,
          prenom: r.fields.prenom || '',
          nom: r.fields.nom || '',
          email: r.fields.email || '',
          telephone: r.fields.telephone || '',
          role,
          // CORRECTION : on lit la vraie adresse d'Airtable (elle contient déjà code postal et ville)
          adresse: r.fields.adresse || '',
          code_postal: '',
          ville: '',
          instructions_livraison: r.fields.instructions_livraison || '',
          compte_actif: r.fields.compte_actif === 'Oui' || r.fields.compte_actif === true,
          statut_validation: (rawStatut as any) || (isClient ? 'Non requis' : 'En attente'),
          disponible_livraison: role === 'Livreur' ? (r.fields.disponible_livraison === 'Oui' || r.fields.disponible_livraison === true) : undefined,
          moyen_deplacement: r.fields.moyen_deplacement || undefined,
          zone_livraison: r.fields.zone_livraison || undefined,
          motif_decision: r.fields.motif_decision,
          valide_par: r.fields.valide_par_id,
          date_decision: r.fields.date_decision
        };
      });

      // 2. Map Restaurants
      const restAirtableIdMap = new Map<string, string>(); // airtableId -> RST-xxx
      const restBusinessIdMap = new Map<string, string>(); // RST-xxx -> airtableId

      const restaurants: (Restaurant & { airtableRecordId: string; note?: number; nb_avis?: number })[] = restsRecs.map(r => {
        const rid = r.fields.restaurant_id || `RST-${r.id}`;
        restAirtableIdMap.set(r.id, rid);
        restBusinessIdMap.set(rid, r.id);

        // Resolve owner: check lookup, link, or email
        let ownerId = '';
        if (r.fields['utilisateur_id (from restaurateur_id)'] && r.fields['utilisateur_id (from restaurateur_id)'].length > 0) {
          ownerId = r.fields['utilisateur_id (from restaurateur_id)'][0];
        } else if (r.fields.restaurateur_id && r.fields.restaurateur_id.length > 0) {
          ownerId = userAirtableIdMap.get(r.fields.restaurateur_id[0]) || '';
        } else if (r.fields.restaurateur_email) {
          ownerId = userEmailMap.get(String(r.fields.restaurateur_email).trim().toLowerCase()) || '';
        }

        const delaiMin = Number(r.fields.temps_livraison_min) || 20;
        const delaiMax = Number(r.fields.temps_livraison_max) || 35;

        return {
          id: rid,
          airtableRecordId: r.id,
          nom: r.fields.nom_restaurant || '',
          proprietaire_id: ownerId,
          cuisine: r.fields.type_cuisine || 'Cuisine du monde',
          description: r.fields.description || r.fields.accroche || '',
          adresse: r.fields.adresse || '7 rue Didot',
          code_postal: String(r.fields.code_postal || '75014'),
          ville: r.fields.ville || 'Paris',
          quartier: r.fields.quartier || 'Plaisance',
          delai: `${delaiMin}–${delaiMax} min`,
          delai_min: delaiMin,
          frais_livraison: Number(r.fields.frais_livraison) || 2.90,
          frais_service: 1.00,
          couleur: '#FFF1E5',
          photo: r.fields.image_url || 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80',
          disponible: r.fields.disponible_commandes === 'Oui' || r.fields.disponible_commandes === true,
          // CORRECTION : le restaurant suit le statut de validation de son restaurateur
          statut_validation: (users.find(u => u.id === ownerId)?.statut_validation as any) || 'Accepté',
          note: Number(r.fields.note) || 4.7,
          nb_avis: Number(r.fields.nb_avis) || 150
        };
      });

      // 3. Map Plats
      const platAirtableIdMap = new Map<string, string>(); // airtableId -> PLT-xxx
      const platBusinessIdMap = new Map<string, string>(); // PLT-xxx -> airtableId

      const plats: (Plat & { airtableRecordId: string })[] = platsRecs.map(r => {
        const pid = r.fields.plat_id || `PLT-${r.id}`;
        platAirtableIdMap.set(r.id, pid);
        platBusinessIdMap.set(pid, r.id);

        return {
          id: pid,
          airtableRecordId: r.id,
          restaurant_id: r.fields.restaurant_id || '',
          nom: r.fields.nom_plat || '',
          description: r.fields.description || '',
          prix: Number(r.fields.prix) || 12.0,
          image_url: r.fields.image_url || 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80',
          categorie: r.fields.categorie || 'Plats',
          disponible: r.fields.disponible === 'Oui' || r.fields.disponible === true
        };
      });

      // 4. Map Commandes
      const cmdAirtableIdMap = new Map<string, string>();
      const cmdBusinessIdMap = new Map<string, string>();

      const commandes: (Commande & { airtableRecordId: string })[] = cmdsRecs.map(r => {
        const cid = r.fields.commande_id || r.fields.reference_commande || `CMD-${r.id}`;
        cmdAirtableIdMap.set(r.id, cid);
        cmdBusinessIdMap.set(cid, r.id);

        // Resolve client
        let clientId = '';
        if (r.fields['utilisateur_id (from client_id)'] && r.fields['utilisateur_id (from client_id)'].length > 0) {
          clientId = r.fields['utilisateur_id (from client_id)'][0];
        } else if (r.fields.client_id && r.fields.client_id.length > 0) {
          clientId = userAirtableIdMap.get(r.fields.client_id[0]) || '';
        }

        // Resolve restaurant
        let restaurantId = '';
        if (r.fields['restaurant_id (from restaurant_id)'] && r.fields['restaurant_id (from restaurant_id)'].length > 0) {
          restaurantId = r.fields['restaurant_id (from restaurant_id)'][0];
        } else if (r.fields.restaurant_id && r.fields.restaurant_id.length > 0) {
          restaurantId = restAirtableIdMap.get(r.fields.restaurant_id[0]) || '';
        }

        return {
          id: cid,
          airtableRecordId: r.id,
          client_id: clientId,
          restaurant_id: restaurantId,
          statut: r.fields.statut || 'En attente du restaurant',
          sous_total: Number(r.fields.sous_total_plats) || 0,
          frais_livraison: Number(r.fields.frais_livraison) || 2.90,
          frais_service: Number(r.fields.frais_service) || 1.00,
          total: Number(r.fields.total_client) || 0,
          adresse_livraison: r.fields.adresse_livraison || '24 rue Daguerre, 75014 Paris',
          instructions_livraison: r.fields.instructions_livraison || "Appeler à l'arrivée",
          temps_preparation_min: r.fields.temps_preparation_min ? Number(r.fields.temps_preparation_min) : undefined,
          motif_refus: r.fields.motif_refus_annulation,
          paiement_simule: 'Validé',
          cree_a: r.fields.date_creation || new Date().toISOString(),
          mise_a_jour_a: r.fields.date_modification || r.fields.date_creation || new Date().toISOString()
        };
      });

      // 5. Map Lignes_commande
      const lignes_commande: (LigneCommande & { airtableRecordId: string })[] = lignesRecs.map(r => {
        const lid = r.fields.ligne_id || `LIG-${r.id}`;

        let cmdId = '';
        if (r.fields['commande_id (from commande_id)'] && r.fields['commande_id (from commande_id)'].length > 0) {
          cmdId = r.fields['commande_id (from commande_id)'][0];
        } else if (r.fields.commande_id && r.fields.commande_id.length > 0) {
          cmdId = cmdAirtableIdMap.get(r.fields.commande_id[0]) || '';
        }

        let platId = '';
        if (r.fields['plat_id (from plat_id)'] && r.fields['plat_id (from plat_id)'].length > 0) {
          platId = r.fields['plat_id (from plat_id)'][0];
        } else if (r.fields.plat_id && r.fields.plat_id.length > 0) {
          platId = platAirtableIdMap.get(r.fields.plat_id[0]) || '';
        }

        return {
          id: lid,
          airtableRecordId: r.id,
          commande_id: cmdId,
          plat_id: platId,
          nom_plat_enregistre: r.fields.nom_plat_enregistre || 'Plat délicieux',
          prix_unitaire_enregistre: Number(r.fields.prix_unitaire_enregistre) || 0,
          quantite: Number(r.fields.quantite) || 1,
          total_ligne: Number(r.fields.total_ligne) || 0
        };
      });

      // 6. Map Missions_livraison
      const missions_livraison: (MissionLivraison & { airtableRecordId: string })[] = missionsRecs.map(r => {
        const mid = r.fields.mission_id || r.fields.reference_mission || `MIS-${r.id}`;

        let cmdId = r.fields.commande_id || '';
        if (!cmdId && r.fields.Commandes && r.fields.Commandes.length > 0) {
          cmdId = cmdAirtableIdMap.get(r.fields.Commandes[0]) || '';
        }

        // Find associated order to link restaurant
        const linkedOrder = commandes.find(c => c.id === cmdId);

        return {
          id: mid,
          airtableRecordId: r.id,
          commande_id: cmdId,
          restaurant_id: linkedOrder?.restaurant_id || 'RST-005',
          livreur_id: r.fields.livreur_id || undefined,
          statut: r.fields.statut || 'Disponible',
          remuneration_annoncee: Number(r.fields.remuneration_annoncee) || 5.50,
          date_attribution: r.fields.date_attribution,
          date_retrait: r.fields.date_retrait,
          date_livraison: r.fields.date_livraison
        };
      });

      // Also enrich commandes with livreur_id from mission
      for (const m of missions_livraison) {
        if (m.livreur_id && m.commande_id) {
          const c = commandes.find(cmd => cmd.id === m.commande_id);
          if (c && !c.livreur_id) {
            c.livreur_id = m.livreur_id;
          }
        }
      }

      // 7. Map Signalements
      const signalements: (Signalement & { airtableRecordId: string })[] = sigsRecs.map(r => {
        const sid = r.fields.signalement_id || r.fields.reference_signalement || `SIG-${r.id}`;
        return {
          id: sid,
          airtableRecordId: r.id,
          commande_id: r.fields.commande_id || '',
          auteur_id: r.fields.auteur_id || '',
          type: (r.fields.type as any) || 'Autre',
          description: r.fields.description || '',
          statut: (r.fields.statut as any) || 'Nouveau',
          reponse_admin: r.fields.reponse,
          resolu_par: r.fields.gestionnaire_id,
          cree_a: r.fields.date_creation || new Date().toISOString()
        };
      });

      // 8. Map Historique_actions
      const historique_actions: (HistoriqueAction & { airtableRecordId: string })[] = actionsRecs.map(r => {
        const aid = r.fields.action_id || `ACT-${r.id}`;
        return {
          id: aid,
          airtableRecordId: r.id,
          acteur_id: r.fields.acteur_id || '',
          action: r.fields.action || 'Action',
          description: `${r.fields.action || ''} (${r.fields.type_objet || ''}) - ${r.fields.nouvel_etat || ''}`,
          date: r.fields.date_action || new Date().toISOString(),
          commande_id: r.fields.commande_id,
          mission_id: r.fields.mission_id
        };
      });

      this.data = {
        utilisateurs: users,
        restaurants,
        plats,
        commandes,
        lignes_commande,
        missions_livraison,
        signalements,
        historique_actions
      };

      this.isInitialized = true;
      console.log(`✅ FoodUp DataStore initialized from Airtable in ${Date.now() - t0}ms:`);
      console.log(`   - Utilisateurs: ${users.length}`);
      console.log(`   - Restaurants: ${restaurants.length}`);
      console.log(`   - Plats: ${plats.length}`);
      console.log(`   - Commandes: ${commandes.length}`);
      console.log(`   - Lignes_commande: ${lignes_commande.length}`);
      console.log(`   - Missions_livraison: ${missions_livraison.length}`);
      console.log(`   - Signalements: ${signalements.length}`);
      console.log(`   - Historique_actions: ${historique_actions.length}`);
    } catch (err) {
      console.error('❌ Failed to initialize DataStore from Airtable:', err);
    }
  }

  // Diagnostic Airtable check for the 8 required tables
  async checkAirtableConnection(): Promise<{
    configured: boolean;
    connected: boolean;
    error?: string;
    tables: Record<string, boolean>;
  }> {
    const pat = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || this.airtablePat;
    const baseId = process.env.AIRTABLE_BASE_ID || this.airtableBaseId;

    const tablesToCheck = [
      'Utilisateurs',
      'Restaurants',
      'Plats',
      'Commandes',
      'Lignes_commande',
      'Missions_livraison',
      'Signalements',
      'Historique_actions'
    ];

    if (!pat || !baseId) {
      const emptyTables: Record<string, boolean> = {};
      tablesToCheck.forEach(t => emptyTables[t] = false);
      return {
        configured: false,
        connected: false,
        error: 'AIRTABLE_PERSONAL_ACCESS_TOKEN et/ou AIRTABLE_BASE_ID non renseignés',
        tables: emptyTables
      };
    }

    const tableStatus: Record<string, boolean> = {};
    let allConnected = true;

    for (const tableName of tablesToCheck) {
      try {
        const res = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?maxRecords=1`, {
          headers: {
            Authorization: `Bearer ${pat}`,
          },
        });
        if (res.ok) {
          tableStatus[tableName] = true;
        } else {
          tableStatus[tableName] = false;
          allConnected = false;
        }
      } catch (e) {
        tableStatus[tableName] = false;
        allConnected = false;
      }
    }

    return {
      configured: true,
      connected: allConnected,
      tables: tableStatus
    };
  }

  // --- Utilisateurs ---
  getUsers(): Utilisateur[] {
    return [...this.data.utilisateurs];
  }

  getUserById(id: string): Utilisateur | undefined {
    return this.data.utilisateurs.find(u => u.id === id || u.airtableRecordId === id);
  }

  getUserByEmail(email: string): Utilisateur | undefined {
    const clean = email.trim().toLowerCase();
    // 1. Exact match
    let user = this.data.utilisateurs.find(u => u.email.toLowerCase() === clean);
    if (user) return user;

    // 2. First-name or user_id lenient match for dev/demo comfort
    user = this.data.utilisateurs.find(u => 
      u.id.toLowerCase() === clean || 
      u.prenom.toLowerCase() === clean ||
      `${u.prenom.toLowerCase()}@foodhop.test` === clean ||
      `${u.prenom.toLowerCase()}.${u.nom.toLowerCase()}@example.com` === clean
    );
    return user;
  }

  createUser(userData: Omit<Utilisateur, 'id'>): Utilisateur {
    const nextNum = this.data.utilisateurs.length + 1;
    const id = `USR-${String(nextNum).padStart(3, '0')}`;
    const user: Utilisateur & { airtableRecordId?: string } = {
      id,
      ...userData
    };
    this.data.utilisateurs.push(user);

    // Sync to Airtable in background
    this.airtablePost('Utilisateurs', {
      utilisateur_id: id,
      prenom: user.prenom,
      nom: user.nom,
      nom_complet: `${user.prenom} ${user.nom}`,
      email: user.email,
      telephone: user.telephone,
      role: user.role,
      compte_actif: user.compte_actif ? 'Oui' : 'Non',
      statut_validation: user.statut_validation,
      moyen_deplacement: user.moyen_deplacement,
      zone_livraison: user.zone_livraison,
      date_creation: new Date().toISOString()
    }).then(res => {
      if (res?.id) user.airtableRecordId = res.id;
    }).catch(err => console.error('Error creating user in Airtable:', err));

    return user;
  }

  // CORRECTION : création d'utilisateur qui ATTEND la réponse d'Airtable,
  // envoie l'adresse complète, et évite les numéros USR en double.
  async createUserAsync(userData: Omit<Utilisateur, 'id'>): Promise<Utilisateur> {
    let maxNum = 0;
    for (const u of this.data.utilisateurs) {
      const num = parseInt(String(u.id).replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
    const id = `USR-${String(maxNum + 1).padStart(3, '0')}`;
    const adresseComplete = [userData.adresse, [userData.code_postal, userData.ville].filter(Boolean).join(' ')]
      .filter(Boolean).join(', ');
    const user: Utilisateur & { airtableRecordId?: string } = {
      id,
      ...userData,
      adresse: adresseComplete,
      code_postal: '',
      ville: ''
    };
    this.data.utilisateurs.push(user);

    const res = await this.airtablePost('Utilisateurs', {
      utilisateur_id: id,
      prenom: user.prenom,
      nom: user.nom,
      nom_complet: `${user.prenom} ${user.nom}`,
      email: user.email,
      telephone: user.telephone,
      adresse: adresseComplete,
      role: user.role,
      compte_actif: user.compte_actif ? 'Oui' : 'Non',
      statut_validation: user.statut_validation,
      moyen_deplacement: user.moyen_deplacement,
      zone_livraison: user.zone_livraison,
      disponible_livraison: user.role === 'Livreur' ? 'Non' : undefined,
      date_creation: new Date().toISOString()
    });
    if (res?.id) user.airtableRecordId = res.id;
    return user;
  }

  updateUser(id: string, updates: Partial<Utilisateur>): Utilisateur | undefined {
    const user = this.data.utilisateurs.find(u => u.id === id);
    if (!user) return undefined;
    Object.assign(user, updates);

    // Sync to Airtable if we have recordId
    if (user.airtableRecordId) {
      const airtableFields: Record<string, any> = {};
      if (updates.statut_validation) airtableFields.statut_validation = updates.statut_validation;
      if (updates.compte_actif !== undefined) airtableFields.compte_actif = updates.compte_actif ? 'Oui' : 'Non';
      if (updates.motif_decision) airtableFields.motif_decision = updates.motif_decision;
      if (updates.valide_par) airtableFields.valide_par_id = updates.valide_par;
      if (updates.date_decision) airtableFields.date_decision = updates.date_decision;
      if (updates.disponible_livraison !== undefined) airtableFields.disponible_livraison = updates.disponible_livraison ? 'Oui' : 'Non';

      if (Object.keys(airtableFields).length > 0) {
        this.airtablePatch('Utilisateurs', user.airtableRecordId, airtableFields)
          .catch(err => console.error('Error updating user in Airtable:', err));
      }
    }

    return user;
  }

  // --- Restaurants ---
  getRestaurants(): Restaurant[] {
    return [...this.data.restaurants];
  }

  getRestaurantById(id: string): Restaurant | undefined {
    return this.data.restaurants.find(r => r.id === id || r.airtableRecordId === id);
  }

  getRestaurantByOwnerId(ownerId: string): Restaurant | undefined {
    return this.data.restaurants.find(r => r.proprietaire_id === ownerId);
  }

  createRestaurant(restData: Omit<Restaurant, 'id'>): Restaurant {
    const nextNum = this.data.restaurants.length + 1;
    const id = `RST-${String(nextNum).padStart(3, '0')}`;
    const rest: Restaurant & { airtableRecordId?: string } = {
      id,
      ...restData
    };
    this.data.restaurants.push(rest);

    // Find owner Airtable record ID
    const owner = this.data.utilisateurs.find(u => u.id === restData.proprietaire_id);

    this.airtablePost('Restaurants', {
      restaurant_id: id,
      nom_restaurant: rest.nom,
      type_cuisine: rest.cuisine,
      description: rest.description,
      adresse: rest.adresse,
      code_postal: Number(rest.code_postal) || 75014,
      ville: rest.ville,
      quartier: rest.quartier,
      frais_livraison: rest.frais_livraison,
      temps_livraison_min: rest.delai_min || 20,
      temps_livraison_max: (rest.delai_min || 20) + 15,
      disponible_commandes: rest.disponible ? 'Oui' : 'Non',
      statut_affiche: 'Ouvert',
      restaurateur_id: owner?.airtableRecordId ? [owner.airtableRecordId] : undefined,
      restaurateur_email: owner?.email
    }).then(res => {
      if (res?.id) rest.airtableRecordId = res.id;
    }).catch(err => console.error('Error creating restaurant in Airtable:', err));

    return rest;
  }

  // CORRECTION : création de restaurant qui ATTEND Airtable, avec le lien vers le restaurateur
  async createRestaurantAsync(restData: Omit<Restaurant, 'id'>): Promise<Restaurant> {
    let maxNum = 0;
    for (const r of this.data.restaurants) {
      const num = parseInt(String(r.id).replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
    const id = `RST-${String(maxNum + 1).padStart(3, '0')}`;
    const rest: Restaurant & { airtableRecordId?: string } = { id, ...restData };
    this.data.restaurants.push(rest);

    const owner = this.data.utilisateurs.find(u => u.id === restData.proprietaire_id);
    const adresseComplete = [rest.adresse, [rest.code_postal, rest.ville].filter(Boolean).join(' ')]
      .filter(Boolean).join(', ');

    const res = await this.airtablePost('Restaurants', {
      restaurant_id: id,
      nom_restaurant: rest.nom,
      type_cuisine: rest.cuisine,
      description: rest.description,
      adresse: adresseComplete,
      code_postal: Number(rest.code_postal) || undefined,
      ville: rest.ville,
      quartier: rest.quartier,
      frais_livraison: rest.frais_livraison,
      temps_livraison_min: rest.delai_min || 20,
      temps_livraison_max: (rest.delai_min || 20) + 15,
      disponible_commandes: rest.disponible ? 'Oui' : 'Non',
      statut_affiche: 'Ouvert',
      restaurateur_id: owner?.airtableRecordId ? [owner.airtableRecordId] : undefined,
      restaurateur_email: owner?.email
    });
    if (res?.id) rest.airtableRecordId = res.id;
    return rest;
  }

  updateRestaurant(id: string, updates: Partial<Restaurant>): Restaurant | undefined {
    const rest = this.data.restaurants.find(r => r.id === id);
    if (!rest) return undefined;
    Object.assign(rest, updates);

    if (rest.airtableRecordId) {
      const airtableFields: Record<string, any> = {};
      if (updates.disponible !== undefined) airtableFields.disponible_commandes = updates.disponible ? 'Oui' : 'Non';
      if (updates.nom) airtableFields.nom_restaurant = updates.nom;
      if (updates.cuisine) airtableFields.type_cuisine = updates.cuisine;

      if (Object.keys(airtableFields).length > 0) {
        this.airtablePatch('Restaurants', rest.airtableRecordId, airtableFields)
          .catch(err => console.error('Error updating restaurant in Airtable:', err));
      }
    }

    return rest;
  }

  // --- Plats ---
  getDishesByRestaurant(restaurantId: string): Plat[] {
    return this.data.plats.filter(p => p.restaurant_id === restaurantId);
  }

  getDishById(id: string): Plat | undefined {
    return this.data.plats.find(p => p.id === id || p.airtableRecordId === id);
  }

  createDish(dishData: Omit<Plat, 'id'>): Plat {
    const nextNum = this.data.plats.length + 1;
    const id = `PLT-${String(nextNum).padStart(3, '0')}`;
    const dish: Plat & { airtableRecordId?: string } = {
      id,
      ...dishData
    };
    this.data.plats.push(dish);

    this.airtablePost('Plats', {
      plat_id: id,
      restaurant_id: dish.restaurant_id,
      nom_plat: dish.nom,
      description: dish.description,
      prix: dish.prix,
      categorie: dish.categorie,
      disponible: dish.disponible ? 'Oui' : 'Non'
    }).then(res => {
      if (res?.id) dish.airtableRecordId = res.id;
    }).catch(err => console.error('Error creating dish in Airtable:', err));

    return dish;
  }

  updateDish(id: string, updates: Partial<Plat>): Plat | undefined {
    const dish = this.data.plats.find(p => p.id === id);
    if (!dish) return undefined;
    Object.assign(dish, updates);

    if (dish.airtableRecordId) {
      const airtableFields: Record<string, any> = {};
      if (updates.disponible !== undefined) airtableFields.disponible = updates.disponible ? 'Oui' : 'Non';
      if (updates.nom) airtableFields.nom_plat = updates.nom;
      if (updates.description !== undefined) airtableFields.description = updates.description;
      if (updates.prix !== undefined) airtableFields.prix = updates.prix;
      if (updates.categorie) airtableFields.categorie = updates.categorie;

      if (Object.keys(airtableFields).length > 0) {
        this.airtablePatch('Plats', dish.airtableRecordId, airtableFields)
          .catch(err => console.error('Error updating dish in Airtable:', err));
      }
    }

    return dish;
  }

  // --- Commandes ---
  getOrders(): Commande[] {
    // CORRECTION : commandes triées de la plus récente à la plus ancienne
    return this.data.commandes
      .slice()
      .sort((a, b) => new Date(b.cree_a).getTime() - new Date(a.cree_a).getTime())
      .map(c => this.enrichOrder(c));
  }

  getOrdersByClient(clientId: string): Commande[] {
    return this.data.commandes
      .filter(c => c.client_id === clientId)
      .sort((a, b) => new Date(b.cree_a).getTime() - new Date(a.cree_a).getTime())
      .map(c => this.enrichOrder(c));
  }

  getOrdersByRestaurant(restaurantId: string): Commande[] {
    return this.data.commandes
      .filter(c => c.restaurant_id === restaurantId)
      .sort((a, b) => new Date(b.cree_a).getTime() - new Date(a.cree_a).getTime())
      .map(c => this.enrichOrder(c));
  }

  getOrderById(id: string): Commande | undefined {
    const order = this.data.commandes.find(c => c.id === id || c.airtableRecordId === id);
    if (!order) return undefined;
    return this.enrichOrder(order);
  }

  private enrichOrder(c: Commande): Commande {
    const restaurant = this.getRestaurantById(c.restaurant_id);
    const client = this.getUserById(c.client_id);
    // Find mission for this order to resolve courier
    const mission = this.data.missions_livraison.find(m => m.commande_id === c.id);
    const courierId = c.livreur_id || (mission && mission.statut !== 'Disponible' ? mission.livreur_id : undefined);
    const livreur = courierId ? this.getUserById(courierId) : undefined;
    const lignes = this.getOrderLinesByOrder(c.id);

    return {
      ...c,
      livreur_id: courierId,
      mission_id: c.mission_id || mission?.id,
      restaurant_nom: restaurant?.nom || 'Restaurant',
      client_nom: client ? `${client.prenom} ${client.nom}` : 'Client',
      livreur_nom: livreur ? `${livreur.prenom} ${livreur.nom}` : undefined,
      lignes
    };
  }

  createOrderWithLines(params: {
    client_id: string;
    restaurant_id: string;
    adresse_livraison: string;
    instructions_livraison?: string;
    items: Array<{ plat_id: string; quantite: number }>;
  }): Commande {
    const client = this.getUserById(params.client_id);
    if (!client) throw new Error('Client introuvable.');

    const restaurant = this.getRestaurantById(params.restaurant_id);
    if (!restaurant) throw new Error('Restaurant introuvable.');

    if (!params.items || params.items.length === 0) {
      throw new Error('Le panier est vide.');
    }

    let calculatedSubTotal = 0;
    const verifiedLines: Array<{
      plat: Plat;
      quantite: number;
      total: number;
    }> = [];

    for (const item of params.items) {
      if (item.quantite <= 0) {
        throw new Error('Quantité invalide.');
      }
      const dish = this.getDishById(item.plat_id);
      if (!dish) {
        throw new Error(`Plat ${item.plat_id} introuvable.`);
      }
      if (dish.restaurant_id !== restaurant.id) {
        throw new Error(`Le plat ${dish.nom} n'appartient pas au restaurant sélectionné.`);
      }
      if (!dish.disponible) {
        throw new Error(`Le plat "${dish.nom}" n'est plus disponible actuellement.`);
      }

      const totalLigne = Number((dish.prix * item.quantite).toFixed(2));
      calculatedSubTotal += totalLigne;
      verifiedLines.push({
        plat: dish,
        quantite: item.quantite,
        total: totalLigne
      });
    }

    calculatedSubTotal = Number(calculatedSubTotal.toFixed(2));
    const fraisLivraison = restaurant.frais_livraison;
    const fraisService = restaurant.frais_service;
    const totalOrder = Number((calculatedSubTotal + fraisLivraison + fraisService).toFixed(2));

    // Generate unique incremental CMD ID avoiding any collision
    let maxCmdNum = 700;
    for (const c of this.data.commandes) {
      const num = parseInt(c.id.replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > maxCmdNum) maxCmdNum = num;
    }
    const orderId = `CMD-${maxCmdNum + 1}`;
    const now = new Date().toISOString();

    const newOrder: Commande & { airtableRecordId?: string } = {
      id: orderId,
      client_id: client.id,
      restaurant_id: restaurant.id,
      statut: 'En attente du restaurant',
      sous_total: calculatedSubTotal,
      frais_livraison: fraisLivraison,
      frais_service: fraisService,
      total: totalOrder,
      adresse_livraison: params.adresse_livraison,
      instructions_livraison: params.instructions_livraison || "Appeler à l'arrivée",
      paiement_simule: 'Validé',
      cree_a: now,
      mise_a_jour_a: now,
    };

    this.data.commandes.unshift(newOrder);

    // Create lines in memory
    const createdLignes: (LigneCommande & { airtableRecordId?: string })[] = [];
    verifiedLines.forEach((line, idx) => {
      const lineId = `LIG-${Date.now()}-${idx}`;
      const newLigne: LigneCommande & { airtableRecordId?: string } = {
        id: lineId,
        commande_id: orderId,
        plat_id: line.plat.id,
        nom_plat_enregistre: line.plat.nom,
        prix_unitaire_enregistre: line.plat.prix,
        quantite: line.quantite,
        total_ligne: line.total,
      };
      this.data.lignes_commande.push(newLigne);
      createdLignes.push(newLigne);
    });

    // Write audit event
    this.createHistoryEvent({
      commande_id: orderId,
      acteur_id: client.id,
      action: 'Création commande',
      description: `${client.prenom} ${client.nom} a validé la commande ${orderId} chez ${restaurant.nom} (Total: ${totalOrder.toFixed(2)} €).`
    });

    // PERSISTENCE TO AIRTABLE:
    // Write Commande to Airtable (adresse_livraison is a computed lookup from client_id, DO NOT send it)
    const clientRecId = (client as any).airtableRecordId;
    const restRecId = (restaurant as any).airtableRecordId;

    this.airtablePost('Commandes', {
      commande_id: orderId,
      reference_commande: orderId,
      client_id: clientRecId ? [clientRecId] : undefined,
      restaurant_id: restRecId ? [restRecId] : undefined,
      statut: 'En attente du restaurant',
      telephone_livraison: client.telephone || '+33 6 10 20 30 40',
      instructions_livraison: newOrder.instructions_livraison,
      sous_total_plats: calculatedSubTotal,
      frais_livraison: fraisLivraison,
      frais_service: fraisService,
      total_client: totalOrder,
      paiement_simule: 'Confirmé',
      date_creation: now,
      date_modification: now
    }).then(createdCmd => {
      if (createdCmd?.id) {
        newOrder.airtableRecordId = createdCmd.id;

        // Write each line to Airtable Lignes_commande linked to the created Commande
        createdLignes.forEach(line => {
          const dishObj = this.getDishById(line.plat_id);
          const platRecId = (dishObj as any)?.airtableRecordId;

          this.airtablePost('Lignes_commande', {
            ligne_id: line.id,
            commande_id: [createdCmd.id],
            plat_id: platRecId ? [platRecId] : undefined,
            nom_plat_enregistre: line.nom_plat_enregistre,
            prix_unitaire_enregistre: line.prix_unitaire_enregistre,
            quantite: line.quantite,
            total_ligne: line.total_ligne
          }).then(resLine => {
            if (resLine?.id) line.airtableRecordId = resLine.id;
          }).catch(err => console.error('Error saving line to Airtable:', err));
        });
      }
    }).catch(err => console.error('Error saving Commande to Airtable:', err));

    return this.enrichOrder(newOrder);
  }

  async createOrderWithLinesAsync(params: {
    client_id: string;
    restaurant_id: string;
    adresse_livraison: string;
    instructions_livraison?: string;
    items: Array<{ plat_id: string; quantite: number }>;
  }): Promise<Commande> {
    const client = this.getUserById(params.client_id);
    if (!client) throw new Error('Client introuvable.');

    const restaurant = this.getRestaurantById(params.restaurant_id);
    if (!restaurant) throw new Error('Restaurant introuvable.');

    if (!params.items || params.items.length === 0) {
      throw new Error('Le panier est vide.');
    }

    let calculatedSubTotal = 0;
    const verifiedLines: Array<{
      plat: Plat;
      quantite: number;
      total: number;
    }> = [];

    for (const item of params.items) {
      if (item.quantite <= 0) {
        throw new Error('Quantité invalide.');
      }
      const dish = this.getDishById(item.plat_id);
      if (!dish) {
        throw new Error(`Plat ${item.plat_id} introuvable.`);
      }
      if (dish.restaurant_id !== restaurant.id) {
        throw new Error(`Le plat ${dish.nom} n'appartient pas au restaurant sélectionné.`);
      }
      if (!dish.disponible) {
        throw new Error(`Le plat "${dish.nom}" n'est plus disponible actuellement.`);
      }

      const totalLigne = Number((dish.prix * item.quantite).toFixed(2));
      calculatedSubTotal += totalLigne;
      verifiedLines.push({
        plat: dish,
        quantite: item.quantite,
        total: totalLigne
      });
    }

    calculatedSubTotal = Number(calculatedSubTotal.toFixed(2));
    const fraisLivraison = restaurant.frais_livraison;
    const fraisService = restaurant.frais_service;
    const totalOrder = Number((calculatedSubTotal + fraisLivraison + fraisService).toFixed(2));

    // Generate unique incremental CMD ID avoiding any collision
    let maxCmdNum = 700;
    for (const c of this.data.commandes) {
      const num = parseInt(c.id.replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > maxCmdNum) maxCmdNum = num;
    }
    const orderId = `CMD-${maxCmdNum + 1}`;
    const now = new Date().toISOString();

    const newOrder: Commande & { airtableRecordId?: string } = {
      id: orderId,
      client_id: client.id,
      restaurant_id: restaurant.id,
      statut: 'En attente du restaurant',
      sous_total: calculatedSubTotal,
      frais_livraison: fraisLivraison,
      frais_service: fraisService,
      total: totalOrder,
      adresse_livraison: params.adresse_livraison,
      instructions_livraison: params.instructions_livraison || "Appeler à l'arrivée",
      paiement_simule: 'Validé',
      cree_a: now,
      mise_a_jour_a: now,
    };

    this.data.commandes.unshift(newOrder);

    // Create lines in memory
    const createdLignes: (LigneCommande & { airtableRecordId?: string })[] = [];
    verifiedLines.forEach((line, idx) => {
      const lineId = `LIG-${Date.now()}-${idx}`;
      const newLigne: LigneCommande & { airtableRecordId?: string } = {
        id: lineId,
        commande_id: orderId,
        plat_id: line.plat.id,
        nom_plat_enregistre: line.plat.nom,
        prix_unitaire_enregistre: line.plat.prix,
        quantite: line.quantite,
        total_ligne: line.total,
      };
      this.data.lignes_commande.push(newLigne);
      createdLignes.push(newLigne);
    });

    // Write audit event
    await this.createHistoryEventAsync({
      commande_id: orderId,
      acteur_id: client.id,
      action: 'Création commande',
      description: `${client.prenom} ${client.nom} a validé la commande ${orderId} chez ${restaurant.nom} (Total: ${totalOrder.toFixed(2)} €).`
    });

    // PERSISTENCE TO AIRTABLE:
    // Write Commande to Airtable (adresse_livraison is a computed lookup from client_id, DO NOT send it)
    const clientRecId = (client as any).airtableRecordId;
    const restRecId = (restaurant as any).airtableRecordId;

    try {
      const createdCmd = await this.airtablePost('Commandes', {
        commande_id: orderId,
        reference_commande: orderId,
        client_id: clientRecId ? [clientRecId] : undefined,
        restaurant_id: restRecId ? [restRecId] : undefined,
        statut: 'En attente du restaurant',
        telephone_livraison: client.telephone || '+33 6 10 20 30 40',
        instructions_livraison: newOrder.instructions_livraison,
        sous_total_plats: calculatedSubTotal,
        frais_livraison: fraisLivraison,
        frais_service: fraisService,
        total_client: totalOrder,
        paiement_simule: 'Confirmé',
        date_creation: now,
        date_modification: now
      });

      if (createdCmd?.id) {
        newOrder.airtableRecordId = createdCmd.id;

        // Write each line to Airtable Lignes_commande linked to the created Commande
        for (const line of createdLignes) {
          const dishObj = this.getDishById(line.plat_id);
          const platRecId = (dishObj as any)?.airtableRecordId;

          const resLine = await this.airtablePost('Lignes_commande', {
            ligne_id: line.id,
            commande_id: [createdCmd.id],
            plat_id: platRecId ? [platRecId] : undefined,
            nom_plat_enregistre: line.nom_plat_enregistre,
            prix_unitaire_enregistre: line.prix_unitaire_enregistre,
            quantite: line.quantite,
            total_ligne: line.total_ligne
          });
          if (resLine?.id) line.airtableRecordId = resLine.id;
        }
      }
    } catch (err) {
      console.error('Error saving Commande/Lines to Airtable:', err);
    }

    return this.enrichOrder(newOrder);
  }

  updateOrder(id: string, updates: Partial<Commande>): Commande | undefined {
    const order = this.data.commandes.find(c => c.id === id);
    if (!order) return undefined;
    const now = new Date().toISOString();
    Object.assign(order, updates, { mise_a_jour_a: now });

    // Sync to Airtable
    if (order.airtableRecordId) {
      const airtableFields: Record<string, any> = {
        date_modification: now
      };
      if (updates.statut) airtableFields.statut = updates.statut;
      if (updates.temps_preparation_min !== undefined) airtableFields.temps_preparation_min = updates.temps_preparation_min;
      if (updates.motif_refus) airtableFields.motif_refus_annulation = updates.motif_refus;

      this.airtablePatch('Commandes', order.airtableRecordId, airtableFields)
        .catch(err => console.error('Error updating Commande in Airtable:', err));
    }

    return this.enrichOrder(order);
  }

  async updateOrderAsync(id: string, updates: Partial<Commande>): Promise<Commande | undefined> {
    const order = this.data.commandes.find(c => c.id === id);
    if (!order) return undefined;
    const now = new Date().toISOString();
    Object.assign(order, updates, { mise_a_jour_a: now });

    if (order.airtableRecordId) {
      const airtableFields: Record<string, any> = {
        date_modification: now
      };
      if (updates.statut) airtableFields.statut = updates.statut;
      if (updates.temps_preparation_min !== undefined) airtableFields.temps_preparation_min = updates.temps_preparation_min;
      if (updates.motif_refus) airtableFields.motif_refus_annulation = updates.motif_refus;

      try {
        await this.airtablePatch('Commandes', order.airtableRecordId, airtableFields);
      } catch (err) {
        console.error('Error updating Commande in Airtable:', err);
      }
    }

    return this.enrichOrder(order);
  }

  // --- Lignes de commande ---
  getOrderLines(orderId?: string): LigneCommande[] {
    if (orderId) {
      return this.data.lignes_commande.filter(l => l.commande_id === orderId);
    }
    return [...this.data.lignes_commande];
  }

  getOrderLinesByOrder(orderId: string): LigneCommande[] {
    return this.data.lignes_commande.filter(l => l.commande_id === orderId);
  }

  // --- Missions de livraison ---
  getDeliveryMissions(): MissionLivraison[] {
    return this.data.missions_livraison.map(m => this.enrichMission(m));
  }

  getMissionById(id: string): MissionLivraison | undefined {
    const m = this.data.missions_livraison.find(mission => mission.id === id || mission.airtableRecordId === id);
    if (!m) return undefined;
    return this.enrichMission(m);
  }

  getMissionByOrder(orderId: string): MissionLivraison | undefined {
    const m = this.data.missions_livraison.find(mission => mission.commande_id === orderId);
    if (!m) return undefined;
    return this.enrichMission(m);
  }

  getAvailableMissions(): MissionLivraison[] {
    return this.data.missions_livraison
      .filter(m => m.statut === 'Disponible' && !m.livreur_id)
      .map(m => this.enrichMission(m));
  }

  async getAvailableMissionsAsync(): Promise<MissionLivraison[]> {
    const pat = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || this.airtablePat;
    const baseId = process.env.AIRTABLE_BASE_ID || this.airtableBaseId;

    if (pat && baseId) {
      try {
        const formula = encodeURIComponent('AND({statut}="Disponible", {livreur_id}="")');
        const res = await fetch(`https://api.airtable.com/v0/${baseId}/Missions_livraison?filterByFormula=${formula}`, {
          headers: { Authorization: `Bearer ${pat}` }
        });
        if (res.ok) {
          const data = await res.json();
          for (const r of (data.records || [])) {
            const mid = r.fields.mission_id || r.fields.reference_mission || `MIS-${r.id}`;
            let cmdId = r.fields.commande_id || '';
            if (!cmdId && r.fields.Commandes && r.fields.Commandes.length > 0) {
              const cmd = this.data.commandes.find(c => c.airtableRecordId === r.fields.Commandes[0]);
              if (cmd) cmdId = cmd.id;
            }
            const linkedOrder = this.data.commandes.find(c => c.id === cmdId);
            const courierField = r.fields.livreur_id;
            if (courierField) continue;

            const existingIndex = this.data.missions_livraison.findIndex(m => m.id === mid || m.airtableRecordId === r.id);
            const missionItem: MissionLivraison & { airtableRecordId: string } = {
              id: mid,
              airtableRecordId: r.id,
              commande_id: cmdId,
              restaurant_id: linkedOrder?.restaurant_id || 'RST-003',
              livreur_id: undefined,
              statut: 'Disponible',
              remuneration_annoncee: Number(r.fields.remuneration_annoncee) || 5.5,
              date_attribution: undefined,
              date_retrait: undefined,
              date_livraison: undefined
            };

            if (existingIndex >= 0) {
              if (this.data.missions_livraison[existingIndex].statut === 'Disponible') {
                this.data.missions_livraison[existingIndex].airtableRecordId = r.id;
              }
            } else {
              this.data.missions_livraison.unshift(missionItem);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching available missions from Airtable:', err);
      }
    }

    return this.data.missions_livraison
      .filter(m => {
        if (m.statut !== 'Disponible') return false;
        if (m.livreur_id) return false;
        const linkedOrder = this.data.commandes.find(c => c.id === m.commande_id);
        if (linkedOrder && ['Livrée', 'Refusée', 'Annulée'].includes(linkedOrder.statut)) {
          return false;
        }
        return true;
      })
      .map(m => this.enrichMission(m));
  }

  getMissionsByCourier(courierId: string): MissionLivraison[] {
    return this.data.missions_livraison
      .filter(m => m.livreur_id === courierId)
      .map(m => this.enrichMission(m));
  }

  createMission(missionData: Omit<MissionLivraison, 'id'>): MissionLivraison {
    const existing = this.data.missions_livraison.find(m => m.commande_id === missionData.commande_id);
    if (existing && existing.statut === 'Disponible' && !existing.livreur_id) {
      return this.enrichMission(existing);
    }

    let maxMisNum = 700;
    for (const m of this.data.missions_livraison) {
      const num = parseInt(m.id.replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > maxMisNum) maxMisNum = num;
    }
    const id = `MIS-${maxMisNum + 1}`;
    const mission: MissionLivraison & { airtableRecordId?: string } = {
      id,
      ...missionData,
      livreur_id: undefined,
      statut: 'Disponible'
    };
    this.data.missions_livraison.unshift(mission);

    // Find linked order
    const order = this.data.commandes.find(c => c.id === missionData.commande_id);
    if (order) {
      order.mission_id = id;
      order.livreur_id = undefined;
    }

    // Write to Airtable Missions_livraison
    this.airtablePost('Missions_livraison', {
      mission_id: id,
      reference_mission: id,
      commande_id: missionData.commande_id,
      Commandes: order?.airtableRecordId ? [order.airtableRecordId] : undefined,
      statut: 'Disponible',
      remuneration_annoncee: mission.remuneration_annoncee,
      date_creation: new Date().toISOString()
    }).then(res => {
      if (res?.id) {
        mission.airtableRecordId = res.id;
        // Also update Commande record in Airtable with mission_id link
        if (order?.airtableRecordId) {
          this.airtablePatch('Commandes', order.airtableRecordId, {
            mission_id: [res.id]
          }).catch(e => console.error('Error linking mission to order:', e));
        }
      }
    }).catch(err => console.error('Error creating mission in Airtable:', err));

    return this.enrichMission(mission);
  }

  async createMissionAsync(missionData: Omit<MissionLivraison, 'id'>): Promise<MissionLivraison> {
    // 1. Check if mission already exists in memory and is available
    const existing = this.data.missions_livraison.find(m => m.commande_id === missionData.commande_id);
    if (existing && existing.statut === 'Disponible' && !existing.livreur_id) {
      return this.enrichMission(existing);
    }

    const pat = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || this.airtablePat;
    const baseId = process.env.AIRTABLE_BASE_ID || this.airtableBaseId;

    // 2. Generate unique incremental MIS ID avoiding collision
    let maxMisNum = 700;
    for (const m of this.data.missions_livraison) {
      const num = parseInt(m.id.replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > maxMisNum) maxMisNum = num;
    }
    const id = `MIS-${maxMisNum + 1}`;
    const mission: MissionLivraison & { airtableRecordId?: string } = {
      id,
      ...missionData,
      livreur_id: undefined, // strictly unassigned upon creation
      statut: 'Disponible'
    };
    this.data.missions_livraison.unshift(mission);

    const order = this.data.commandes.find(c => c.id === missionData.commande_id);
    if (order) {
      order.mission_id = id;
      order.livreur_id = undefined;
    }

    if (pat && baseId) {
      try {
        const res = await this.airtablePost('Missions_livraison', {
          mission_id: id,
          reference_mission: id,
          commande_id: missionData.commande_id,
          Commandes: order?.airtableRecordId ? [order.airtableRecordId] : undefined,
          statut: 'Disponible',
          remuneration_annoncee: mission.remuneration_annoncee,
          date_creation: new Date().toISOString()
        });

        if (res?.id) {
          mission.airtableRecordId = res.id;
          if (order?.airtableRecordId) {
            await this.airtablePatch('Commandes', order.airtableRecordId, {
              mission_id: [res.id]
            }).catch(e => console.error('Error linking mission to order:', e));
          }
        }
      } catch (err) {
        console.error('Error creating mission in Airtable:', err);
      }
    }

    return this.enrichMission(mission);
  }

  updateDeliveryMission(id: string, updates: Partial<MissionLivraison>): MissionLivraison | undefined {
    const mission = this.data.missions_livraison.find(m => m.id === id || m.airtableRecordId === id);
    if (!mission) return undefined;
    Object.assign(mission, updates);

    // Sync to Airtable
    if (mission.airtableRecordId) {
      const airtableFields: Record<string, any> = {};
      if (updates.statut !== undefined) airtableFields.statut = updates.statut;
      if (updates.livreur_id !== undefined) airtableFields.livreur_id = updates.livreur_id || null;
      if (updates.date_attribution !== undefined) airtableFields.date_attribution = updates.date_attribution;
      if (updates.date_retrait !== undefined) airtableFields.date_retrait = updates.date_retrait;
      if (updates.date_livraison !== undefined) airtableFields.date_livraison = updates.date_livraison;

      this.airtablePatch('Missions_livraison', mission.airtableRecordId, airtableFields)
        .catch(err => console.error('Error updating mission in Airtable:', err));
    }

    if (updates.livreur_id) {
      const order = this.data.commandes.find(c => c.id === mission.commande_id);
      if (order) {
        order.livreur_id = updates.livreur_id;
      }
    }

    return this.enrichMission(mission);
  }

  async updateDeliveryMissionAsync(id: string, updates: Partial<MissionLivraison>): Promise<MissionLivraison | undefined> {
    const mission = this.data.missions_livraison.find(m => m.id === id || m.airtableRecordId === id);
    if (!mission) return undefined;
    Object.assign(mission, updates);

    if (mission.airtableRecordId) {
      const airtableFields: Record<string, any> = {};
      if (updates.statut !== undefined) airtableFields.statut = updates.statut;
      if (updates.livreur_id !== undefined) airtableFields.livreur_id = updates.livreur_id || null;
      if (updates.date_attribution !== undefined) airtableFields.date_attribution = updates.date_attribution;
      if (updates.date_retrait !== undefined) airtableFields.date_retrait = updates.date_retrait;
      if (updates.date_livraison !== undefined) airtableFields.date_livraison = updates.date_livraison;

      try {
        await this.airtablePatch('Missions_livraison', mission.airtableRecordId, airtableFields);
      } catch (err) {
        console.error('Error updating mission in Airtable:', err);
      }
    }

    if (updates.livreur_id) {
      const order = this.data.commandes.find(c => c.id === mission.commande_id);
      if (order) {
        order.livreur_id = updates.livreur_id;
      }
    }

    return this.enrichMission(mission);
  }

  private enrichMission(m: MissionLivraison): MissionLivraison {
    const order = this.data.commandes.find(c => c.id === m.commande_id);
    const restaurant = this.getRestaurantById(m.restaurant_id);
    const client = order ? this.getUserById(order.client_id) : undefined;

    return {
      ...m,
      restaurant_nom: restaurant?.nom || 'Restaurant',
      restaurant_adresse: restaurant ? `${restaurant.adresse}` : undefined,
      //restaurant_adresse: restaurant ? `${restaurant.adresse}, ${restaurant.code_postal} ${restaurant.ville}` : undefined,
      adresse_retrait: restaurant ? `${restaurant.adresse}, ${restaurant.code_postal} ${restaurant.ville}` : undefined,
      adresse_livraison: order?.adresse_livraison,
      client_nom: client ? `${client.prenom} ${client.nom}` : 'Client',
      instructions_livraison: order?.instructions_livraison,
      statut_commande: order?.statut,
      temps_preparation_min: order?.temps_preparation_min,
      // AJOUT : téléphone du client et détail de ce qu'il faut récupérer
      client_telephone: client?.telephone,
      lignes: this.getOrderLinesByOrder(m.commande_id),
    };
  }

  // --- Signalements ---
  getReports(): Signalement[] {
    return this.data.signalements
      .sort((a, b) => new Date(b.cree_a).getTime() - new Date(a.cree_a).getTime())
      .map(s => this.enrichReport(s));
  }

  getReportsByOrder(orderId: string): Signalement[] {
    return this.data.signalements
      .filter(s => s.commande_id === orderId)
      .map(s => this.enrichReport(s));
  }

  createReport(reportData: Omit<Signalement, 'id' | 'cree_a' | 'statut'>): Signalement {
    const nextNum = this.data.signalements.length + 1;
    const id = `SIG-${String(nextNum).padStart(3, '0')}`;
    const now = new Date().toISOString();
    const report: Signalement & { airtableRecordId?: string } = {
      id,
      ...reportData,
      statut: 'Nouveau',
      cree_a: now
    };
    this.data.signalements.unshift(report);

    const user = this.getUserById(reportData.auteur_id);
    this.createHistoryEvent({
      commande_id: reportData.commande_id,
      acteur_id: reportData.auteur_id,
      action: 'Création signalement',
      description: `${user?.prenom || 'Un utilisateur'} a signalé un incident (${reportData.type}) sur la commande ${reportData.commande_id}.`
    });

    // Write to Airtable
    this.airtablePost('Signalements', {
      signalement_id: id,
      reference_signalement: id,
      commande_id: report.commande_id,
      auteur_id: report.auteur_id,
      type: report.type,
      description: report.description,
      statut: 'Nouveau',
      date_creation: now
    }).then(res => {
      if (res?.id) report.airtableRecordId = res.id;
    }).catch(err => console.error('Error creating report in Airtable:', err));

    return this.enrichReport(report);
  }

  updateReport(id: string, updates: Partial<Signalement>): Signalement | undefined {
    const report = this.data.signalements.find(s => s.id === id);
    if (!report) return undefined;
    Object.assign(report, updates);

    if (report.airtableRecordId) {
      const airtableFields: Record<string, any> = {};
      if (updates.statut) airtableFields.statut = updates.statut;
      if (updates.reponse_admin) airtableFields.reponse = updates.reponse_admin;
      if (updates.resolu_par) airtableFields.gestionnaire_id = updates.resolu_par;
      if (updates.statut === 'Résolu') airtableFields.date_resolution = new Date().toISOString();

      this.airtablePatch('Signalements', report.airtableRecordId, airtableFields)
        .catch(err => console.error('Error updating report in Airtable:', err));
    }

    return this.enrichReport(report);
  }

  private enrichReport(s: Signalement): Signalement {
    const auteur = this.getUserById(s.auteur_id);
    const order = this.data.commandes.find(c => c.id === s.commande_id);
    const restaurant = order ? this.getRestaurantById(order.restaurant_id) : undefined;
    return {
      ...s,
      auteur_nom: auteur ? `${auteur.prenom} ${auteur.nom}` : 'Utilisateur',
      auteur_role: auteur?.role,
      restaurant_nom: restaurant?.nom
    };
  }

  // --- Historique Actions ---
  getHistory(): HistoriqueAction[] {
    return this.data.historique_actions
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(h => {
        const actor = this.getUserById(h.acteur_id);
        return {
          ...h,
          acteur_nom: actor ? `${actor.prenom} ${actor.nom}` : undefined,
          acteur_role: actor?.role
        };
      });
  }

  createHistoryEvent(eventData: Omit<HistoriqueAction, 'id' | 'date'>): HistoriqueAction {
    const nextNum = this.data.historique_actions.length + 1;
    const id = `ACT-${Date.now()}`;
    const now = new Date().toISOString();
    const event: HistoriqueAction & { airtableRecordId?: string } = {
      id,
      ...eventData,
      date: now
    };
    this.data.historique_actions.unshift(event);

    // Write to Airtable
    this.airtablePost('Historique_actions', {
      action_id: id,
      acteur_id: event.acteur_id,
      date_action: now,
      type_objet: event.commande_id ? 'Commande' : 'Général',
      commande_id: event.commande_id,
      action: event.action
    }).then(res => {
      if (res?.id) event.airtableRecordId = res.id;
    }).catch(err => console.error('Error logging history in Airtable:', err));

    return event;
  }

  async createHistoryEventAsync(eventData: Omit<HistoriqueAction, 'id' | 'date'>): Promise<HistoriqueAction> {
    const id = `ACT-${Date.now()}`;
    const now = new Date().toISOString();
    const event: HistoriqueAction & { airtableRecordId?: string } = {
      id,
      ...eventData,
      date: now
    };
    this.data.historique_actions.unshift(event);

    try {
      const res = await this.airtablePost('Historique_actions', {
        action_id: id,
        acteur_id: event.acteur_id,
        date_action: now,
        type_objet: event.commande_id ? 'Commande' : 'Général',
        commande_id: event.commande_id,
        action: event.action
      });
      if (res?.id) event.airtableRecordId = res.id;
    } catch (err) {
      console.error('Error logging history in Airtable:', err);
    }

    return event;
  }
}

export const db = new DataStore();
