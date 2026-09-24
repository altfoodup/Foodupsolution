import React, { useState, useEffect, useRef } from 'react';
import { Restaurant, Commande } from '../../types.js';
import { Search, Bell, ChevronDown, ChevronRight, ChevronLeft, Image as ImageIcon } from 'lucide-react';

interface Props {
  userName: string;
  userAddress: string;
  onSelectRestaurant: (restaurant: Restaurant) => void;
  onOpenOrder: (orderId: string) => void;
}

export const ClientHome: React.FC<Props> = ({
  userName,
  userAddress,
  onSelectRestaurant,
  onOpenOrder
}) => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [activeOrder, setActiveOrder] = useState<Commande | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tout');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const categoriesRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const categories = [
    'Tout',
    'Cuisine française',
    'Végétarienne',
    'Tibétaine',
    'Bistrot moderne',
    'Italienne',
    'Thaïlandaise',
    'Healthy & bowls',
    'Mexicaine',
    'Libanaise',
    'Japonaise',
    'Indienne',
    'Pizza'
  ];

  useEffect(() => {
    fetchData();
    // Poll every 12 seconds to keep active order status fresh
    const interval = setInterval(fetchActiveOrder, 12000);
    return () => clearInterval(interval);
  }, []);

  const updateScrollButtons = () => {
    if (categoriesRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = categoriesRef.current;
      setCanScrollLeft(scrollLeft > 6);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
    }
  };

  useEffect(() => {
    // Initial check and on resize
    updateScrollButtons();
    const el = categoriesRef.current;
    if (el) {
      el.addEventListener('scroll', updateScrollButtons, { passive: true });
    }
    window.addEventListener('resize', updateScrollButtons);
    return () => {
      if (el) el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, []);

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoriesRef.current) {
      const scrollAmount = direction === 'left' ? -180 : 180;
      categoriesRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchRestaurants(), fetchActiveOrder()]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRestaurants = async () => {
    try {
      const res = await fetch('/api/restaurants');
      if (res.ok) {
        const data = await res.json();
        setRestaurants(data);
      }
    } catch (e) {
      console.error('Error fetching restaurants', e);
    }
  };

  const fetchActiveOrder = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const orders: Commande[] = await res.json();
        // Active order is non-final
        const active = orders.find(o => 
          o.statut === 'En attente du restaurant' ||
          o.statut === 'En préparation' ||
          o.statut === 'Prête' ||
          o.statut === 'En livraison'
        );
        setActiveOrder(active || null);
      }
    } catch (e) {
      console.error('Error fetching orders', e);
    }
  };

  const normalizeText = (s: string) => 
    (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  const filteredRestaurants = restaurants.filter(r => {
    const normCuisine = normalizeText(r.cuisine || '');
    const normSel = normalizeText(selectedCategory);
    
    const matchesCategory = selectedCategory === 'Tout' || 
      normCuisine === normSel ||
      normCuisine.includes(normSel) ||
      normSel.includes(normCuisine) ||
      (normSel.startsWith('ital') && normCuisine.startsWith('ital')) ||
      (normSel.startsWith('liban') && normCuisine.startsWith('liban')) ||
      (normSel.startsWith('veget') && normCuisine.startsWith('veget')) ||
      (normSel.startsWith('tibet') && normCuisine.startsWith('tibet')) ||
      (normSel.startsWith('bistrot') && normCuisine.startsWith('bistrot')) ||
      (normSel.startsWith('thai') && normCuisine.startsWith('thai')) ||
      (normSel.startsWith('mexic') && normCuisine.startsWith('mexic')) ||
      (normSel.startsWith('japon') && normCuisine.startsWith('japon')) ||
      (normSel.startsWith('indien') && normCuisine.startsWith('indien')) ||
      (normSel.startsWith('franc') && normCuisine.startsWith('franc'));

    const normQuery = normalizeText(searchQuery);
    const matchesSearch = searchQuery === '' || 
      normalizeText(r.nom).includes(normQuery) ||
      normCuisine.includes(normQuery) ||
      normalizeText(r.description).includes(normQuery);

    return matchesCategory && matchesSearch;
  });

  const getActiveOrderTitle = (statut: Commande['statut']) => {
    switch (statut) {
      case 'En attente du restaurant':
        return 'Commande transmise au restaurant';
      case 'En préparation':
        return 'Votre commande est en préparation';
      case 'Prête':
        return 'Commande prête pour la livraison';
      case 'En livraison':
        return 'Votre commande est en route !';
      default:
        return 'Commande en cours';
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-24">
      {/* ===== BARRE DU HAUT ===== */}
      <header className="flex items-center gap-3 pt-4 px-5">
        <div 
          className="w-9 h-9 rounded-[10px] bg-[#F26A00] flex items-center justify-center shrink-0 shadow-xs" 
          aria-hidden="true"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 11h16a8 8 0 0 1-16 0z"/>
            <path d="M9 7c0-1.5 1-2 1-3.5"/>
            <path d="M14 7c0-1.5 1-2 1-3.5"/>
          </svg>
        </div>

        <button type="button" className="grow flex flex-col items-start gap-0.5 border-none bg-transparent p-0 text-left text-[#20201E] cursor-pointer">
          <small className="text-[12px] font-medium text-[#6B6B66]">Livrer à</small>
          <strong className="flex items-center gap-1 text-[15px] font-bold text-[#20201E]">
            {userAddress || '12 rue Oberkampf'}
            <ChevronDown size={15} strokeWidth={2.2} />
          </strong>
        </button>

        <button 
          type="button" 
          className="relative w-11 h-11 rounded-full border border-[#E8E5DF] bg-white text-[#20201E] flex items-center justify-center hover:bg-[#FFF8EE] transition-colors"
          aria-label="Notifications"
        >
          <Bell size={19} strokeWidth={1.8} />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#F26A00] border-2 border-white"></span>
        </button>
      </header>

      {/* ===== SALUTATION ===== */}
      <div className="px-5">
        <h1 className="text-[26px] font-extrabold text-[#20201E] tracking-tight leading-tight">
          Bonjour {userName.split(' ')[0]}
        </h1>
        <p className="mt-1 text-[15px] text-[#6B6B66]">
          Qu'est-ce qui vous ferait plaisir ?
        </p>
      </div>

      {/* ===== RECHERCHE ===== */}
      <div className="px-5">
        <label className="flex items-center gap-2.5 h-12 px-3.5 border border-[#E8E5DF] rounded-[14px] bg-white text-[#6B6B66] focus-within:border-[#F26A00] transition-colors">
          <Search size={19} strokeWidth={1.8} className="text-[#6B6B66] shrink-0" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Un plat, un restaurant…"
            className="grow border-none outline-none bg-transparent text-[15px] text-[#20201E] placeholder:text-[#6B6B66]"
          />
        </label>
      </div>

      {/* ===== COMMANDE EN COURS (SI EXISTANTE) ===== */}
      {activeOrder && (
        <div className="px-5">
          <button
            type="button"
            onClick={() => onOpenOrder(activeOrder.id)}
            className="w-full text-left flex items-center gap-3 p-3.5 rounded-[16px] bg-[#FFF1E5] border border-[#F8D9BF] text-[#20201E] hover:bg-[#ffe8d6] transition-colors cursor-pointer shadow-xs"
          >
            <div className="w-10 h-10 rounded-[12px] bg-white flex items-center justify-center shrink-0 text-[#C94F00] shadow-2xs">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 11h16a8 8 0 0 1-16 0z"/>
                <path d="M9 7c0-1.5 1-2 1-3.5"/>
                <path d="M14 7c0-1.5 1-2 1-3.5"/>
              </svg>
            </div>
            <div className="grow flex flex-col gap-0.5">
              <b className="text-[14px] font-bold text-[#20201E]">
                {getActiveOrderTitle(activeOrder.statut)}
              </b>
              <span className="text-[13px] text-[#6B6B66]">
                {activeOrder.restaurant_nom || 'Restaurant'} · {activeOrder.temps_preparation_min ? `prête dans ~${activeOrder.temps_preparation_min} min` : 'suivi disponible'}
              </span>
            </div>
            <ChevronRight size={18} strokeWidth={2.2} className="text-[#C94F00] shrink-0" />
          </button>
        </div>
      )}

      {/* ===== CATÉGORIES (AVEC FLÈCHES ET SCROLLBAR) ===== */}
      <div className="relative px-5">
        {/* Flèche gauche */}
        {canScrollLeft && (
          <div className="absolute left-2 top-5 -translate-y-1/2 z-10">
            <button
              type="button"
              onClick={() => scrollCategories('left')}
              className="w-7 h-7 rounded-full bg-white/95 backdrop-blur-xs shadow-md border border-[#E8E5DF] text-[#20201E] hover:text-[#C94F00] hover:border-[#C94F00] flex items-center justify-center transition-all cursor-pointer"
              aria-label="Spécialités précédentes"
            >
              <ChevronLeft size={16} strokeWidth={2.4} />
            </button>
          </div>
        )}

        {/* Flèche droite */}
        {canScrollRight && (
          <div className="absolute right-2 top-5 -translate-y-1/2 z-10">
            <button
              type="button"
              onClick={() => scrollCategories('right')}
              className="w-7 h-7 rounded-full bg-white/95 backdrop-blur-xs shadow-md border border-[#E8E5DF] text-[#20201E] hover:text-[#C94F00] hover:border-[#C94F00] flex items-center justify-center transition-all cursor-pointer"
              aria-label="Spécialités suivantes"
            >
              <ChevronRight size={16} strokeWidth={2.4} />
            </button>
          </div>
        )}

        {/* Conteneur défilant avec scrollbar visible */}
        <div
          ref={categoriesRef}
          className="flex gap-2 overflow-x-auto pb-2.5 pt-0.5 category-scrollbar scroll-smooth"
        >
          {categories.map((cat) => {
            const isActive = cat === selectedCategory;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 h-10 px-4 rounded-[20px] border text-[14px] transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#C94F00] border-[#C94F00] text-white font-semibold shadow-xs'
                    : 'bg-white border-[#E8E5DF] text-[#20201E] font-medium hover:border-[#C94F00]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== RESTAURANTS PRÈS DE CHEZ VOUS ===== */}
      <section className="px-5">
        <div className="flex items-baseline justify-between mb-3.5">
          <h2 className="text-[18px] font-bold text-[#20201E]">Près de chez vous</h2>
          <button 
            type="button" 
            onClick={() => { setSelectedCategory('Tout'); setSearchQuery(''); }}
            className="text-[14px] font-semibold text-[#C94F00] hover:underline"
          >
            Tout voir
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex flex-col gap-2.5">
                <div className="h-[150px] bg-[#E8E5DF]/60 rounded-[16px]"></div>
                <div className="h-4 bg-[#E8E5DF]/60 rounded w-1/2"></div>
                <div className="h-3 bg-[#E8E5DF]/40 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        ) : filteredRestaurants.length === 0 ? (
          <div className="p-8 text-center text-[14px] text-[#6B6B66] border border-dashed border-[#E8E5DF] rounded-[16px] bg-white/50">
            Aucun restaurant de cette catégorie près de chez vous pour le moment.
          </div>
        ) : (
          <div className="flex flex-col gap-4.5">
            {filteredRestaurants.map((r) => {
              return (
                <div
                  key={r.id}
                  onClick={() => onSelectRestaurant(r)}
                  className="group flex flex-col gap-2.5 text-[#20201E] cursor-pointer"
                >
                  <div
                    className="relative h-[150px] rounded-[16px] border border-[#E8E5DF] bg-cover bg-center overflow-hidden transition-transform duration-200 group-hover:scale-[1.01]"
                    style={{
                      backgroundColor: r.couleur || '#FFF1E5',
                      backgroundImage: r.photo ? `url('${r.photo}')` : undefined,
                    }}
                  >
                    {!r.photo && (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-[#9E3E00] text-[12px] font-medium">
                        <ImageIcon size={30} strokeWidth={1.5} />
                        <span>Photo du restaurant</span>
                      </div>
                    )}

                    {/* Badge Délai */}
                    <span className="absolute top-2.5 left-2.5 text-[12px] font-semibold text-[#20201E] bg-white/95 backdrop-blur-xs rounded-full px-2.5 py-1 shadow-xs">
                      {r.delai}
                    </span>

                    {!r.disponible && (
                      <span className="absolute top-2.5 right-2.5 text-[11px] font-bold text-white bg-[#D64545] rounded-full px-2.5 py-1 shadow-xs">
                        Indisponible
                      </span>
                    )}
                  </div>

                  <div className="flex items-start justify-between gap-2 px-0.5">
                    <div className="flex flex-col gap-0.5 grow">
                      <b className="text-[16px] font-bold text-[#20201E] group-hover:text-[#C94F00] transition-colors">
                        {r.nom}
                      </b>
                      <span className="text-[13px] text-[#6B6B66] line-clamp-1">
                        {r.cuisine} · {r.description}
                      </span>
                    </div>
                    <span className="text-[13px] text-[#6B6B66] font-medium whitespace-nowrap shrink-0 pt-0.5">
                      Livraison {r.frais_livraison.toFixed(2).replace('.', ',')} €
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
