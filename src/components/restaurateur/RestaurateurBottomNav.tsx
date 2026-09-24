import React from 'react';
import { Clock, Utensils, TrendingUp } from 'lucide-react';

interface Props {
  activeTab: 'commandes' | 'carte' | 'activite';
  onChangeTab: (tab: 'commandes' | 'carte' | 'activite') => void;
  ordersCount?: number;
  dishesCount?: number;
}

export const RestaurateurBottomNav: React.FC<Props> = ({
  activeTab,
  onChangeTab,
  ordersCount = 0,
  dishesCount = 0
}) => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E8E5DF] shadow-[0_-2px_10px_rgba(0,0,0,0.03)]">
      <nav className="max-w-4xl mx-auto grid grid-cols-3 px-2 pt-2 pb-[calc(14px+env(safe-area-inset-bottom,0px))]">
        <button
          type="button"
          onClick={() => onChangeTab('commandes')}
          className={`flex flex-col items-center justify-center gap-1 min-h-[50px] transition-colors text-[11px] ${
            activeTab === 'commandes' ? 'text-[#C94F00] font-semibold' : 'text-[#6B6B66] font-medium'
          }`}
        >
          <div className="relative">
            <Clock size={22} strokeWidth={activeTab === 'commandes' ? 2.2 : 1.8} />
            {ordersCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#C94F00] text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                {ordersCount}
              </span>
            )}
          </div>
          <span>Commandes</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeTab('carte')}
          className={`flex flex-col items-center justify-center gap-1 min-h-[50px] transition-colors text-[11px] ${
            activeTab === 'carte' ? 'text-[#C94F00] font-semibold' : 'text-[#6B6B66] font-medium'
          }`}
        >
          <div className="relative">
            <Utensils size={22} strokeWidth={activeTab === 'carte' ? 2.2 : 1.8} />
            {dishesCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#6B6B66] text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                {dishesCount}
              </span>
            )}
          </div>
          <span>Plats</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeTab('activite')}
          className={`flex flex-col items-center justify-center gap-1 min-h-[50px] transition-colors text-[11px] ${
            activeTab === 'activite' ? 'text-[#C94F00] font-semibold' : 'text-[#6B6B66] font-medium'
          }`}
        >
          <TrendingUp size={22} strokeWidth={activeTab === 'activite' ? 2.2 : 1.8} />
          <span>Activité</span>
        </button>
      </nav>
    </footer>
  );
};
