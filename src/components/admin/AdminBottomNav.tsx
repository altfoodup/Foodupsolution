import React from 'react';
import { Activity, Package, AlertTriangle, Users } from 'lucide-react';

interface Props {
  activeTab: 'dashboard' | 'commandes' | 'incidents' | 'partenaires';
  onChangeTab: (tab: 'dashboard' | 'commandes' | 'incidents' | 'partenaires') => void;
  ordersCount?: number;
  incidentsCount?: number;
}

export const AdminBottomNav: React.FC<Props> = ({
  activeTab,
  onChangeTab,
  ordersCount = 0,
  incidentsCount = 0
}) => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E8E5DF] shadow-[0_-2px_10px_rgba(0,0,0,0.03)]">
      <nav className="max-w-5xl mx-auto grid grid-cols-4 px-2 pt-2 pb-[calc(14px+env(safe-area-inset-bottom,0px))]">
        <button
          type="button"
          onClick={() => onChangeTab('dashboard')}
          className={`flex flex-col items-center justify-center gap-1 min-h-[50px] transition-colors text-[11px] ${
            activeTab === 'dashboard' ? 'text-[#C94F00] font-semibold' : 'text-[#6B6B66] font-medium'
          }`}
        >
          <Activity size={22} strokeWidth={activeTab === 'dashboard' ? 2.2 : 1.8} />
          <span>Tableau de bord</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeTab('commandes')}
          className={`flex flex-col items-center justify-center gap-1 min-h-[50px] transition-colors text-[11px] ${
            activeTab === 'commandes' ? 'text-[#C94F00] font-semibold' : 'text-[#6B6B66] font-medium'
          }`}
        >
          <div className="relative">
            <Package size={22} strokeWidth={activeTab === 'commandes' ? 2.2 : 1.8} />
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
          onClick={() => onChangeTab('incidents')}
          className={`flex flex-col items-center justify-center gap-1 min-h-[50px] transition-colors text-[11px] ${
            activeTab === 'incidents' ? 'text-[#C94F00] font-semibold' : 'text-[#6B6B66] font-medium'
          }`}
        >
          <div className="relative">
            <AlertTriangle size={22} strokeWidth={activeTab === 'incidents' ? 2.2 : 1.8} />
            {incidentsCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#D64545] text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                {incidentsCount}
              </span>
            )}
          </div>
          <span>Incidents</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeTab('partenaires')}
          className={`flex flex-col items-center justify-center gap-1 min-h-[50px] transition-colors text-[11px] ${
            activeTab === 'partenaires' ? 'text-[#C94F00] font-semibold' : 'text-[#6B6B66] font-medium'
          }`}
        >
          <Users size={22} strokeWidth={activeTab === 'partenaires' ? 2.2 : 1.8} />
          <span>Partenaires</span>
        </button>
      </nav>
    </footer>
  );
};
