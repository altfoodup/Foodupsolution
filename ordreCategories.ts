// Ordre d'affichage des catégories de plats, identique partout dans l'appli :
// Entrées, Plats, Pizza, Pâtes, Desserts, puis Boissons, puis tout le reste.
// La comparaison ignore majuscules, accents et pluriel ("Entrée", "entrées", "Pâte"…).
export const CATEGORIES_PLATS = ['Entrées', 'Plats', 'Pizza', 'Pâtes', 'Desserts', 'Boissons'];

const normaliser = (c: string) =>
  (c || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export const rangCategorie = (c: string): number => {
  const n = normaliser(c);
  if (n.startsWith('entree')) return 0;
  if (n.startsWith('pizza')) return 2;
  if (n.startsWith('pate')) return 3;
  if (n.startsWith('plat')) return 1;
  if (n.startsWith('dessert')) return 4;
  if (n.startsWith('boisson')) return 5;
  return 6;
};

// Classe des plats : par catégorie (ordre ci-dessus), puis par nom (ordre alphabétique)
export const comparerPlats = (a: { categorie: string; nom: string }, b: { categorie: string; nom: string }) =>
  rangCategorie(a.categorie) - rangCategorie(b.categorie) ||
  (a.nom || '').localeCompare(b.nom || '', 'fr', { sensitivity: 'base' });
