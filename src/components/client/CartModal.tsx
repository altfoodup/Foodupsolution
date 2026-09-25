import React, { useState, useEffect } from 'react';
import { Restaurant, Plat } from '../../types.js';
import { useCart } from '../../context/CartContext.js';
import { ArrowLeft, Clock, Bike, Plus, Check } from 'lucide-react';

interface Props {
  restaurant: Restaurant;
  onBack: () => void;
  onOpenCart: () => void;
}

export const RestaurantView: React.FC<Props> = ({
  restaurant,
  onBack,
  onOpenCart
}) => {
  const { addItem, items, itemCount, total } = useCart();
  const [plats, setPlats] = useState<Plat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tout');
  const [addedNotice, setAddedNotice] = useState<string | null>(null);

  useEffect(() => {
    fetchDishes();
  }, [restaurant.id]);

  const fetchDishes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}/dishes`);
      if (res.ok) {
        const data = await res.json();
        setPlats(data);
      }
    } catch (e) {
      console.error('Error fetching dishes', e);
    } finally {
      setLoading(false);
    }
  };

  // Ordre d'affichage : entrées, plats, desserts, boissons, puis le reste.
  // On compare sans majuscules ni accents, et sur le début du mot,
  // pour reconnaître aussi "Entrée", "Plat principal", "dessert", etc.
  const normalize = (c: string) =>
    (c || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const categoryRank = (c: string) => {
    const n = normalize(c);
    if (n.startsWith('entree')) return 0;
    if (n.startsWith('plat')) return 1;
    if (n.startsWith('dessert')) return 2;
    if (n.startsWith('boisson')) return 3;
    return 4;
  };

  const categories = ['Tout', ...Array.from(new Set(plats.map(p => p.categorie)))
    .sort((a, b) => categoryRank(a) - categoryRank(b))];

  const filteredPlats = plats
    .filter(p => selectedCategory === 'Tout' || p.categorie === selectedCategory)
    .sort((a, b) => categoryRank(a.categorie) - categoryRank(b.categorie));

  const handleAdd = (plat: Plat) => {
    addItem(plat, restaurant);
    setAddedNotice(plat.nom);
    setTimeout(() => setAddedNotice(null), 1800);
  };

  const getQuantityInCart = (platId: string) => {
    const item = items.find(i => i.plat.id === platId);
    return item ? item.quantite : 0;
  };

  return (
    <div className="flex flex-col min-h-screen pb-28">
      {/* Top Header / Photo */}
      <div className="relative h-[220px] bg-[#FFF1E5] border-b border-[#E8E5DF]">
        {restaurant.photo && (
          <img
            src={restaurant.photo}
            alt={restaurant.nom}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        <button
          type="button"
          onClick={onBack}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/90 text-[#20201E] flex items-center justify-center backdrop-blur-xs shadow-md hover:bg-white transition-colors"
          aria-label="Retour"
        >
          <ArrowLeft size={20} strokeWidth={2.2} />
        </button>

        <div className="absolute bottom-4 left-5 right-5 text-white">
          <span className="text-[12px] font-semibold bg-[#F26A00] px-2.5 py-0.5 rounded-full inline-block mb-1.5 shadow-2xs">
            {restaurant.cuisine}
          </span>
          <h1 className="text-[24px] font-extrabold text-white leading-tight drop-shadow-xs">
            {restaurant.nom}
          </h1>
        </div>
      </div>

      {/* Info bar */}
      <div className="px-5 py-3.5 bg-white border-b border-[#E8E5DF] flex items-center justify-between text-xs text-[#6B6B66]">
        <div className="flex items-center gap-1.5">
          <Clock size={15} className="text-[#F26A00]" />
          <span className="font-semibold text-[#20201E]">{restaurant.delai}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Bike size={15} className="text-[#F26A00]" />
          <span>Livraison {restaurant.frais_livraison.toFixed(2).replace('.', ',')} €</span>
        </div>
        <span className="text-[#6B6B66]">{restaurant.quartier}</span>
      </div>

      {/* Description */}
      <div className="px-5 pt-3 pb-2 text-[14px] text-[#6B6B66]">
        {restaurant.description}
      </div>

      {/* Categories */}
      {categories.length > 2 && (
        <div className="flex gap-2 overflow-x-auto px-5 py-3 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                selectedCategory === cat
                  ? 'bg-[#C94F00] text-white border-[#C94F00]'
                  : 'bg-white text-[#20201E] border-[#E8E5DF] hover:border-[#C94F00]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Dishes List */}
      <div className="px-5 pt-3 flex flex-col gap-3">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse h-24 bg-white rounded-2xl border border-[#E8E5DF]"></div>
            ))}
          </div>
        ) : filteredPlats.length === 0 ? (
          <div className="text-center py-10 text-sm text-[#6B6B66]">
            Aucun plat disponible dans cette catégorie pour le moment.
          </div>
        ) : (
          filteredPlats.map((plat) => {
            const inCart = getQuantityInCart(plat.id);
            return (
              <div
                key={plat.id}
                className="bg-white rounded-2xl border border-[#E8E5DF] p-3.5 flex gap-3.5 items-center shadow-2xs hover:border-[#F26A00]/40 transition-colors"
              >
                {/* Dish Photo */}
                <div className="relative w-20 h-20 rounded-xl bg-[#FFF1E5] shrink-0 overflow-hidden border border-[#E8E5DF]">
                  <img
                    src={plat.image_url || restaurant.photo}
                    alt={plat.nom}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  {inCart > 0 && (
                    <span className="absolute top-1 left-1 bg-[#C94F00] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border border-white">
                      {inCart}
                    </span>
                  )}
                </div>

                {/* Dish details */}
                <div className="grow min-w-0 flex flex-col gap-1">
                  <b className="text-[15px] font-bold text-[#20201E] leading-tight truncate">
                    {plat.nom}
                  </b>
                  <p className="text-[12px] text-[#6B6B66] line-clamp-2">
                    {plat.description}
                  </p>
                  <span className="text-[14px] font-extrabold text-[#C94F00] mt-0.5">
                    {plat.prix.toFixed(2).replace('.', ',')} €
                  </span>
                </div>

                {/* Add button */}
                <button
                  type="button"
                  onClick={() => handleAdd(plat)}
                  className="w-10 h-10 rounded-full bg-[#FFF1E5] hover:bg-[#F26A00] text-[#C94F00] hover:text-white border border-[#F8D9BF] hover:border-[#F26A00] flex items-center justify-center shrink-0 transition-colors"
                  aria-label={`Ajouter ${plat.nom}`}
                >
                  <Plus size={18} strokeWidth={2.5} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Added Toast */}
      {addedNotice && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#138A63] text-white px-4 py-2 rounded-full shadow-lg text-xs font-semibold flex items-center gap-1.5 animate-bounce">
          <Check size={14} strokeWidth={2.5} />
          <span>Ajouté : {addedNotice}</span>
        </div>
      )}

      {/* Sticky Bottom Cart Bar */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 max-w-[480px] mx-auto p-4 bg-white/95 backdrop-blur-md border-t border-[#E8E5DF]">
          <button
            type="button"
            onClick={onOpenCart}
            className="w-full py-3.5 px-5 bg-[#F26A00] hover:bg-[#C94F00] text-white font-bold rounded-2xl flex items-center justify-between shadow-md transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-white text-[#C94F00] text-xs font-extrabold flex items-center justify-center">
                {itemCount}
              </span>
              <span>Voir le panier</span>
            </div>
            <span className="text-base font-extrabold">
              {total.toFixed(2).replace('.', ',')} €
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
