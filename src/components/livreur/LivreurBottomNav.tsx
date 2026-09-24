import React from 'react';
import { Bike, Navigation, DollarSign } from 'lucide-react';

interface Props {
  activeTab: 'disponibles' | 'active' | 'gains';
  onChangeTab: (tab: 'disponibles' | 'active' | 'gains') => void;
  availableMissionsCount?: number;
  hasActiveMission?: boolean;
}

export const LivreurBottomNav: React.FC<Props> = ({
  activeTab,
  onChangeTab,
  availableMissionsCount = 0,
  hasActiveMission = false
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E8E5DF] max-w-[480px] mx-auto grid grid-cols-3 px-2 pt-2 pb-[calc(14px+env(safe-area-inset-bottom,0px))] shadow-[0_-2px_10px_rgba(0,0,0,0.03)]">
      <button
        type="button"
        onClick={() => onChangeTab('disponibles')}
        className={`flex flex-col items-center justify-center gap-1 min-h-[50px] transition-colors text-[11px] ${
          activeTab === 'disponibles' ? 'text-[#C94F00] font-semibold' : 'text-[#6B6B66] font-medium'
        }`}
      >
        <div className="relative">
          <Bike size={22} strokeWidth={activeTab === 'disponibles' ? 2.2 : 1.8} />
          {availableMissionsCount > 0 && (
            <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#C94F00] text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
              {availableMissionsCount}
            </span>
          )}
        </div>
        <span>Missions</span>
      </button>

      <button
        type="button"
        onClick={() => onChangeTab('active')}
        className={`flex flex-col items-center justify-center gap-1 min-h-[50px] transition-colors text-[11px] ${
          activeTab === 'active' ? 'text-[#C94F00] font-semibold' : 'text-[#6B6B66] font-medium'
        }`}
      >
        <div className="relative">
          <Navigation size={22} strokeWidth={activeTab === 'active' ? 2.2 : 1.8} />
          {hasActiveMission && (
            <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-[#138A63] border-2 border-white animate-pulse" />
          )}
        </div>
        <span>Course active</span>
      </button>

      <button
        type="button"
        onClick={() => onChangeTab('gains')}
        className={`flex flex-col items-center justify-center gap-1 min-h-[50px] transition-colors text-[11px] ${
          activeTab === 'gains' ? 'text-[#C94F00] font-semibold' : 'text-[#6B6B66] font-medium'
        }`}
      >
        <DollarSign size={22} strokeWidth={activeTab === 'gains' ? 2.2 : 1.8} />
        <span>Mes gains</span>
      </button>
    </nav>
  );
};
