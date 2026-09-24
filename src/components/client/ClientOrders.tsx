import React, { useState, useEffect } from 'react';
import { Commande } from '../../types.js';
import { useAuth } from '../../context/AuthContext.js';
import { Clock, ChevronRight, Package, RefreshCw } from 'lucide-react';

interface Props {
  onSelectOrder: (orderId: string) => void;
}

export const ClientOrders: React.FC<Props> = ({ onSelectOrder }) => {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 12000);
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  const fetchOrders = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/orders', {
        headers: { 'x-user-id': currentUser.id }
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (e) {
      console.error('Error fetching orders', e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchOrders();
  };

  const activeOrders = orders.filter(o => 
    o.statut === 'En attente du restaurant' ||
    o.statut === 'En préparation' ||
    o.statut === 'Prête' ||
    o.statut === 'En livraison'
  );

  const pastOrders = orders.filter(o =>
    o.statut === 'Livrée' ||
    o.statut === 'Refusée' ||
    o.statut === 'Annulée'
  );

  const getStatusBadge = (statut: Commande['statut']) => {
    switch (statut) {
      case 'En attente du restaurant':
        return <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">En attente</span>;
      case 'En préparation':
        return <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#FFF1E5] text-[#C94F00]">En préparation</span>;
      case 'Prête':
        return <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">Prête</span>;
      case 'En livraison':
        return <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#E7F4EE] text-[#138A63]">En livraison</span>;
      case 'Livrée':
        return <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Livrée</span>;
      case 'Refusée':
        return <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800">Refusée</span>;
      case 'Annulée':
        return <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">Annulée</span>;
    }
  };

  return (
    <div className="flex flex-col gap-6 px-5 pt-5 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#20201E]">Vos commandes</h1>
          <p className="text-xs text-[#6B6B66]">Suivi en direct et historique</p>
        </div>
        <button
          type="button"
          onClick={handleManualRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E8E5DF] bg-white text-xs font-medium text-[#20201E] hover:bg-[#FFF8EE] transition-colors"
          title="Actualiser les statuts"
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-[#F26A00]' : ''} />
          <span>Actualiser</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse h-28 bg-white rounded-2xl border border-[#E8E5DF]"></div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="p-10 text-center border border-dashed border-[#E8E5DF] rounded-2xl bg-white/50 flex flex-col items-center gap-2">
          <Package size={32} className="text-[#6B6B66]" />
          <p className="text-sm font-semibold text-[#20201E]">Vous n'avez pas encore passé de commande.</p>
          <p className="text-xs text-[#6B6B66]">Retrouvez les restaurants de votre quartier sur l'accueil.</p>
        </div>
      ) : (
        <>
          {/* Active Orders */}
          {activeOrders.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-bold text-[#20201E] uppercase tracking-wide">
                En cours ({activeOrders.length})
              </h2>
              {activeOrders.map(order => (
                <div
                  key={order.id}
                  onClick={() => onSelectOrder(order.id)}
                  className="p-4 bg-[#FFF1E5] border border-[#F8D9BF] rounded-2xl cursor-pointer hover:shadow-md transition-all flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#9E3E00]">{order.id}</span>
                      <h3 className="text-base font-extrabold text-[#20201E]">{order.restaurant_nom}</h3>
                    </div>
                    {getStatusBadge(order.statut)}
                  </div>

                  <div className="text-xs text-[#6B6B66]">
                    {order.lignes && order.lignes.length > 0 ? (
                      <span>{order.lignes.map(l => `${l.quantite}x ${l.nom_plat_enregistre}`).join(', ')}</span>
                    ) : (
                      <span>{order.total.toFixed(2)} €</span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[#F8D9BF] flex items-center justify-between text-xs">
                    <span className="font-extrabold text-[#C94F00]">
                      Total : {order.total.toFixed(2).replace('.', ',')} €
                    </span>
                    <span className="font-bold text-[#C94F00] flex items-center gap-1 hover:underline">
                      Suivre la commande <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Past Orders */}
          {pastOrders.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-bold text-[#6B6B66] uppercase tracking-wide">
                Historique ({pastOrders.length})
              </h2>
              {pastOrders.map(order => (
                <div
                  key={order.id}
                  onClick={() => onSelectOrder(order.id)}
                  className="p-4 bg-white border border-[#E8E5DF] rounded-2xl cursor-pointer hover:border-[#F26A00] transition-all flex flex-col gap-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#6B6B66]">{order.id}</span>
                        <span className="text-xs text-[#6B6B66]">
                          {new Date(order.cree_a).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-[#20201E] mt-0.5">{order.restaurant_nom}</h3>
                    </div>
                    {getStatusBadge(order.statut)}
                  </div>

                  {order.lignes && order.lignes.length > 0 && (
                    <p className="text-xs text-[#6B6B66] line-clamp-1">
                      {order.lignes.map(l => `${l.quantite}x ${l.nom_plat_enregistre}`).join(', ')}
                    </p>
                  )}

                  <div className="pt-2 border-t border-[#E8E5DF] flex items-center justify-between text-xs">
                    <span className="font-bold text-[#20201E]">
                      {order.total.toFixed(2).replace('.', ',')} €
                    </span>
                    <span className="text-[#C94F00] font-semibold flex items-center gap-1">
                      Voir le détail <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
