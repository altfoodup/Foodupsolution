export type Role = 'Client' | 'Restaurateur' | 'Livreur' | 'Administrateur';

export type StatutCommande = 
  | 'En attente du restaurant'
  | 'En préparation'
  | 'Prête'
  | 'En livraison'
  | 'Livrée'
  | 'Refusée'
  | 'Annulée';

export type StatutMission = 
  | 'Disponible'
  | 'Attribuée'
  | 'En cours'
  | 'Terminée'
  | 'Annulée';

export type StatutSignalement = 
  | 'Nouveau'
  | 'En cours'
  | 'Résolu';

export type StatutValidation = 
  | 'Non requis'
  | 'En attente'
  | 'Accepté'
  | 'Validé'
  | 'Refusé';

export interface Utilisateur {
  id: string; // USR-xxx
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  role: Role;
  adresse: string;
  code_postal: string;
  ville: string;
  instructions_livraison?: string;
  compte_actif: boolean;
  statut_validation: StatutValidation;
  disponible_livraison?: boolean; // Spécifique livreurs
  moyen_deplacement?: string; // Spécifique livreurs
  zone_livraison?: string; // Spécifique livreurs
  motif_decision?: string; // Motif décision admin
  valide_par?: string; // ID admin
  date_decision?: string;
}

export interface Restaurant {
  id: string; // RST-xxx
  nom: string;
  proprietaire_id: string; // ID Utilisateur USR-xxx
  cuisine: string;
  description: string;
  adresse: string;
  code_postal: string;
  ville: string;
  quartier: string;
  delai: string;
  delai_min: number;
  frais_livraison: number;
  frais_service: number;
  couleur: string;
  photo: string;
  disponible: boolean;
  statut_validation: StatutValidation;
  horaires?: string;
}

export interface Plat {
  id: string; // PLT-xxx
  restaurant_id: string; // RST-xxx
  nom: string;
  description: string;
  prix: number;
  image_url: string;
  categorie: string; // 'Plats' | 'Entrées' | 'Desserts' | 'Boissons'
  disponible: boolean;
}

export interface LigneCommande {
  id: string; // LIG-xxx
  commande_id: string; // CMD-xxx
  plat_id: string; // PLT-xxx
  nom_plat_enregistre: string; // Snapshot
  prix_unitaire_enregistre: number; // Snapshot
  quantite: number;
  total_ligne: number; // Snapshot
}

export interface Commande {
  id: string; // CMD-xxx
  client_id: string; // USR-xxx
  restaurant_id: string; // RST-xxx
  statut: StatutCommande;
  sous_total: number;
  frais_livraison: number;
  frais_service: number;
  total: number;
  adresse_livraison: string;
  instructions_livraison?: string;
  temps_preparation_min?: number;
  motif_refus?: string;
  livreur_id?: string; // USR-xxx
  mission_id?: string; // MIS-xxx
  paiement_simule: 'Validé' | 'Annulé';
  cree_a: string;
  mise_a_jour_a: string;
  // Données enrichies pour commodité
  lignes?: LigneCommande[];
  restaurant_nom?: string;
  client_nom?: string;
  livreur_nom?: string;
}

export interface MissionLivraison {
  id: string; // MIS-xxx
  commande_id: string; // CMD-xxx
  restaurant_id: string; // RST-xxx
  livreur_id?: string; // USR-xxx
  statut: StatutMission;
  remuneration_annoncee: number;
  date_attribution?: string;
  date_retrait?: string;
  date_livraison?: string;
  // Données enrichies
  restaurant_nom?: string;
  restaurant_adresse?: string;
  adresse_retrait?: string;
  adresse_livraison?: string;
  client_nom?: string;
  instructions_livraison?: string;
  statut_commande?: StatutCommande;
  temps_preparation_min?: number;
  client_telephone?: string;
  lignes?: LigneCommande[];
}

export interface Signalement {
  id: string; // SIG-xxx
  commande_id: string; // CMD-xxx
  auteur_id: string; // USR-xxx
  type: 'Retard' | 'Commande incorrecte' | 'Client absent' | 'Problème de livraison' | 'Annulation' | 'Autre';
  description: string;
  statut: StatutSignalement;
  reponse_admin?: string;
  resolu_par?: string;
  cree_a: string;
  // Enrichi
  auteur_nom?: string;
  auteur_role?: Role;
  restaurant_nom?: string;
}

export interface HistoriqueAction {
  id: string; // ACT-xxx
  commande_id?: string;
  mission_id?: string;
  acteur_id: string;
  action: string;
  description: string;
  date: string;
  acteur_nom?: string;
  acteur_role?: Role;
}

export interface PanierItem {
  plat: Plat;
  quantite: number;
}

export interface PanierState {
  restaurantId: string | null;
  items: PanierItem[];
}
