import React, { useState, useEffect } from 'react';
import { useCart } from '../../context/CartContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { Plat } from '../../types.js';
import { X, Plus, Minus, Trash2, ArrowLeft, ShoppingBag, Sparkles, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOrderSuccess: (orderId: string) => void;
  onContinueShopping: () => void;
}

export const CartModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onOrderSuccess,
  onContinueShopping,
}) => {
  const { 
    restaurant, 
    items, 
    updateQuantity, 
    removeItem, 
    clearCart, 
    subtotal, 
    fraisLivraison, 
    fraisService, 
    total,
    addItem
  } = useCart();
  const { currentUser } = useAuth();

  const [crossSellDishes, setCrossSellDishes] = useState<Plat[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Contraintes de livraison saisies au moment de la commande (code, interphone, étage…)
  const [instructions, setInstructions] = useState<string>(currentUser?.instructions_livraison || '');

  // Fetch cross-sell candidates from the same restaurant (desserts, drinks, sides)
  useEffect(() => {
    if (restaurant && isOpen) {
      fetch(`/api/restaurants/${restaurant.id}/dishes`)
        .then(res => res.json())
        .then((dishes: Plat[]) => {
          const currentIds = new Set(items.map(i => i.plat.id));
          // Filter out items already in cart, prioritize Desserts / Boissons
          const candidates = dishes
            .filter(d => !currentIds.has(d.id) && d.disponible)
            .sort((a, b) => {
              const priority = (cat: string) => cat === 'Desserts' ? 1 : cat === 'Boissons' ? 2 : 3;
              return priority(a.categorie) - priority(b.categorie);
            })
            .slice(0, 3);
          setCrossSellDishes(candidates);
        })
        .catch(err => console.error('Error fetching cross-sell', err));
    }
  }, [restaurant?.id, items, isOpen]);

  if (!isOpen) return null;

  const handleCheckout = async () => {
    if (!currentUser) {
      setError('Veuillez vous connecter pour valider la commande.');
      return;
    }
    if (!restaurant || items.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          adresse_livraison: currentUser.adresse || '',
          instructions_livraison: instructions.trim(),
          items: items.map(i => ({
            plat_id: i.plat.id,
            quantite: i.quantite
          }))
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de la validation de la commande.');
      }

      const createdOrder = await res.json();
      clearCart();
      onClose();
      onOrderSuccess(createdOrder.id);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#FFFCF8] flex flex-col max-w-[480px] mx-auto overflow-hidden animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E5DF] bg-white">
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center border border-[#E8E5DF] text-[#20201E] hover:bg-[#FFF8EE]"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <div className="text-center">
          <h2 className="text-base font-bold text-[#20201E]">Mon Panier</h2>
          {restaurant && (
            <p className="text-xs text-[#6B6B66]">{restaurant.nom}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center border border-[#E8E5DF] text-[#6B6B66] hover:text-[#20201E]"
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      {/* Content */}
      <div className="grow overflow-y-auto p-5 flex flex-col gap-6">
        {items.length === 0 ? (
          <div className="my-auto text-center py-16 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-[#FFF1E5] text-[#C94F00] flex items-center justify-center">
              <ShoppingBag size={28} />
            </div>
            <h3 className="text-lg font-bold text-[#20201E]">Votre panier est vide</h3>
            <p className="text-sm text-[#6B6B66] max-w-xs">
              Découvrez les plats des restaurants indépendants de votre quartier.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 px-6 py-2.5 rounded-full bg-[#F26A00] text-white font-semibold text-sm hover:bg-[#C94F00] transition-colors"
            >
              Découvrir la carte
            </button>
          </div>
        ) : (
          <>
            {/* Error banner */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                {error}
              </div>
            )}

            {/* Items list */}
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <div
                  key={item.plat.id}
                  className="p-3.5 bg-white rounded-2xl border border-[#E8E5DF] flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-center gap-3 grow min-w-0">
                    <img
                      src={item.plat.image_url || restaurant?.photo}
                      alt={item.plat.nom}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-xl object-cover shrink-0 border border-[#E8E5DF]"
                    />
                    <div className="grow min-w-0">
                      <h4 className="text-sm font-bold text-[#20201E] truncate">
                        {item.plat.nom}
                      </h4>
                      <span className="text-xs font-semibold text-[#C94F00]">
                        {(item.plat.prix * item.quantite).toFixed(2).replace('.', ',')} €
                      </span>
                    </div>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-2 bg-[#FFF8EE] rounded-xl px-2 py-1 border border-[#E8E5DF]">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.plat.id, -1)}
                      className="w-6 h-6 rounded-lg bg-white flex items-center justify-center text-[#20201E] hover:text-[#C94F00]"
                      aria-label="Diminuer"
                    >
                      {item.quantite === 1 ? <Trash2 size={13} className="text-[#D64545]" /> : <Minus size={13} />}
                    </button>
                    <span className="text-xs font-bold text-[#20201E] w-4 text-center">
                      {item.quantite}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.plat.id, 1)}
                      className="w-6 h-6 rounded-lg bg-white flex items-center justify-center text-[#20201E] hover:text-[#C94F00]"
                      aria-label="Augmenter"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* + Ajouter autre chose */}
            <button
              type="button"
              onClick={onContinueShopping}
              className="py-2.5 px-4 rounded-xl border border-dashed border-[#E8E5DF] hover:border-[#F26A00] text-[#C94F00] text-xs font-semibold text-center bg-white/60 transition-colors"
            >
              + Ajouter autre chose chez {restaurant?.nom}
            </button>

            {/* CROSS-SELL : "Une petite douceur ?" */}
            {crossSellDishes.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Sparkles size={16} className="text-[#F26A00]" />
                  <h3 className="text-sm font-bold text-[#20201E]">
                    Une petite douceur pour compléter ?
                  </h3>
                </div>
                <div className="flex flex-col gap-2">
                  {crossSellDishes.map((dish) => (
                    <div
                      key={dish.id}
                      className="p-2.5 bg-[#FFF8EE] border border-[#F8D9BF] rounded-xl flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 grow min-w-0">
                        <img
                          src={dish.image_url || restaurant?.photo}
                          alt={dish.nom}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-lg object-cover shrink-0 border border-[#E8E5DF]"
                        />
                        <div className="grow min-w-0">
                          <p className="text-xs font-bold text-[#20201E] truncate">
                            {dish.nom}
                          </p>
                          <span className="text-xs font-extrabold text-[#C94F00]">
                            {dish.prix.toFixed(2).replace('.', ',')} €
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addItem(dish, restaurant!)}
                        className="px-3 py-1 bg-[#F26A00] hover:bg-[#C94F00] text-white text-xs font-bold rounded-lg shrink-0 transition-colors"
                      >
                        + Ajouter
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delivery address review */}
            <div className="p-3 bg-white border border-[#E8E5DF] rounded-xl text-xs flex flex-col gap-1">
              <span className="font-semibold text-[#20201E]">Adresse de livraison</span>
              <p className="text-[#6B6B66]">
                {currentUser?.adresse || 'Aucune adresse enregistrée sur votre profil'}
              </p>
              <label className="font-semibold text-[#20201E] mt-2">Contraintes de livraison</label>
              <textarea
                rows={2}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Code porte, interphone, étage, instructions…"
                className="w-full px-3 py-2 border border-[#E8E5DF] rounded-xl text-xs focus:outline-none focus:border-[#F26A00] bg-white"
              />
            </div>

            {/* Price breakdown */}
            <div className="bg-white rounded-2xl border border-[#E8E5DF] p-4 flex flex-col gap-2 text-xs">
              <div className="flex justify-between text-[#6B6B66]">
                <span>Sous-total</span>
                <span>{subtotal.toFixed(2).replace('.', ',')} €</span>
              </div>
              <div className="flex justify-between text-[#6B6B66]">
                <span>Frais de livraison</span>
                <span>{fraisLivraison.toFixed(2).replace('.', ',')} €</span>
              </div>
              <div className="flex justify-between text-[#6B6B66]">
                <span>Frais de service</span>
                <span>{fraisService.toFixed(2).replace('.', ',')} €</span>
              </div>
              <div className="border-t border-[#E8E5DF] pt-2 mt-1 flex justify-between text-sm font-extrabold text-[#20201E]">
                <span>Total</span>
                <span className="text-[#C94F00]">{total.toFixed(2).replace('.', ',')} €</span>
              </div>
            </div>

            {/* Notice simulated payment */}
            <div className="text-center text-[12px] text-[#6B6B66] bg-[#FFF8EE] border border-[#F8D9BF] p-2.5 rounded-xl">
              💡 <b>Paiement simulé — aucun débit bancaire</b>. Votre commande sera immédiatement transmise à {restaurant?.nom}.
            </div>
          </>
        )}
      </div>

      {/* Sticky Bottom Checkout Bar */}
      {items.length > 0 && (
        <div className="p-4 bg-white border-t border-[#E8E5DF] shadow-[0_-4px_12px_rgba(0,0,0,0.04)] flex flex-col gap-3">
          {/* Boutons d'action déplacés en bas de l'écran */}
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={onContinueShopping}
              className="text-xs font-semibold text-[#C94F00] hover:underline"
            >
              ← Continuer mes achats
            </button>
            <button
              type="button"
              onClick={clearCart}
              className="text-xs text-[#6B6B66] hover:text-[#D64545] transition-colors"
            >
              Vider le panier
            </button>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleCheckout}
            className="w-full py-4 bg-[#F26A00] hover:bg-[#C94F00] text-white font-extrabold text-base rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99] disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Transmission de la commande…</span>
            ) : (
              <span>Commander — {total.toFixed(2).replace('.', ',')} €</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
