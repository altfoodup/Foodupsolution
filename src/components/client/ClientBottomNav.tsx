import React from 'react';
import { Home, ClipboardList, ShoppingBag, User } from 'lucide-react';

interface Props {
  activeTab: 'accueil' | 'commandes' | 'profil';
  onChangeTab: (tab: 'accueil' | 'commandes' | 'profil') => void;
  cartCount: number;
  onOpenCart: () => void;
}

export const ClientBottomNav: React.FC<Props> = ({
  activeTab,
  onChangeTab,
  cartCount,
  onOpenCart
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E8E5DF] max-w-[480px] mx-auto grid grid-cols-4 px-2 pt-2 pb-[calc(14px+env(safe-area-inset-bottom,0px))] shadow-[0_-2px_10px_rgba(0,0,0,0.03)]">
      <button
        type="button"
        onClick={() => onChangeTab('accueil')}
        className={`flex flex-col items-center justify-center gap-1 min-h-[50px] transition-colors text-[11px] ${
          activeTab === 'accueil' ? 'text-[#C94F00] font-semibold' : 'text-[#6B6B66] font-medium'
        }`}
      >
        <Home size={22} strokeWidth={activeTab === 'accueil' ? 2.2 : 1.8} />
        <span>Accueil</span>
      </button>

      <button
        type="button"
        onClick={() => onChangeTab('commandes')}
        className={`flex flex-col items-center justify-center gap-1 min-h-[50px] transition-colors text-[11px] ${
          activeTab === 'commandes' ? 'text-[#C94F00] font-semibold' : 'text-[#6B6B66] font-medium'
        }`}
      >
        <ClipboardList size={22} strokeWidth={activeTab === 'commandes' ? 2.2 : 1.8} />
        <span>Commandes</span>
      </button>

      <button
        type="button"
        onClick={onOpenCart}
        className="relative flex flex-col items-center justify-center gap-1 min-h-[50px] transition-colors text-[11px] text-[#6B6B66] font-medium"
      >
        <div className="relative">
          <ShoppingBag size={22} strokeWidth={1.8} />
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#C94F00] text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
              {cartCount}
            </span>
          )}
        </div>
        <span>Panier</span>
      </button>

      <button
        type="button"
        onClick={() => onChangeTab('profil')}
        className={`flex flex-col items-center justify-center gap-1 min-h-[50px] transition-colors text-[11px] ${
          activeTab === 'profil' ? 'text-[#C94F00] font-semibold' : 'text-[#6B6B66] font-medium'
        }`}
      >
        <User size={22} strokeWidth={activeTab === 'profil' ? 2.2 : 1.8} />
        <span>Profil</span>
      </button>
    </nav>
  );
};
