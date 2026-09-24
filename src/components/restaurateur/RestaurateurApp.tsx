import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Commande, Plat, Restaurant } from '../../types.js';
import { RestaurateurBottomNav } from './RestaurateurBottomNav.js';
import { 
  Store, 
  Utensils, 
  TrendingUp, 
  User, 
  Clock, 
  Check, 
  X, 
  Plus, 
  Bike, 
  RefreshCw, 
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Package,
  LogOut
} from 'lucide-react';

export const RestaurateurApp: React.FC = () => {
  const { currentUser, currentRestaurant, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<'commandes' | 'carte' | 'activite' | 'profil'>('commandes');
  const [orders, setOrders] = useState<Commande[]>([]);
  const [plats, setPlats] = useState<Plat[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Accept / Refuse Modals state
  const [orderToAccept, setOrderToAccept] = useState<Commande | null>(null);
  const [prepTimeInput, setPrepTimeInput] = useState<number>(20);
  const [orderToRefuse, setOrderToRefuse] = useState<Commande | null>(null);
  const [refuseReason, setRefuseReason] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Add / Edit Dish Modal state
  const [isDishModalOpen, setIsDishModalOpen] = useState(false);
  const [editingDish, setEditingDish] = useState<Plat | null>(null);
  const [dishNom, setDishNom] = useState('');
  const [dishDesc, setDishDesc] = useState('');
  const [dishPrix, setDishPrix] = useState('');
  const [dishCat, setDishCat] = useState('Plats');

  // Activity filter
  const [activityPeriod, setActivityPeriod] = useState<'jour' | 'semaine' | 'mois'>('jour');

  useEffect(() => {
    fetchRestaurantData();
    const interval = setInterval(fetchOrdersOnly, 10000);
    return () => clearInterval(interval);
  }, [currentUser?.id, currentRestaurant?.id]);

  const fetchRestaurantData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchOrdersOnly(), fetchDishesOnly()]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchOrdersOnly = async () => {
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
      console.error('Error fetching restaurant orders', e);
    }
  };

  const fetchDishesOnly = async () => {
    if (!currentRestaurant) return;
    try {
      const res = await fetch(`/api/restaurants/${currentRestaurant.id}/dishes`);
      if (res.ok) {
        const data = await res.json();
        setPlats(data);
      }
    } catch (e) {
      console.error('Error fetching dishes', e);
    }
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchRestaurantData();
  };

  // Transaction: Accept Order
  const handleConfirmAccept = async () => {
    if (!orderToAccept || !currentUser) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/orders/${orderToAccept.id}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({
          temps_preparation_min: Number(prepTimeInput) || 20
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de l’acceptation');
      }

      setOrderToAccept(null);
      await fetchOrdersOnly();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Transaction: Refuse Order
  const handleConfirmRefuse = async () => {
    if (!orderToRefuse || !currentUser) return;
    if (!refuseReason.trim()) {
      setActionError('Le motif de refus est obligatoire.');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/orders/${orderToRefuse.id}/refuse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({
          motif: refuseReason.trim()
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors du refus');
      }

      setOrderToRefuse(null);
      setRefuseReason('');
      await fetchOrdersOnly();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Transaction: Mark Order Ready
  const handleMarkReady = async (orderId: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/orders/${orderId}/ready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        }
      });
      if (res.ok) {
        await fetchOrdersOnly();
      } else {
        const err = await res.json();
        alert(err.error || 'Erreur lors du marquage');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Dish availability toggle
  const handleToggleDish = async (plat: Plat) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/dishes/${plat.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({ disponible: !plat.disponible })
      });
      if (res.ok) {
        setPlats(prev => prev.map(p => p.id === plat.id ? { ...p, disponible: !p.disponible } : p));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Save new or edited dish
  const handleSaveDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRestaurant || !currentUser) return;

    try {
      if (editingDish) {
        const res = await fetch(`/api/dishes/${editingDish.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': currentUser.id
          },
          body: JSON.stringify({
            nom: dishNom,
            description: dishDesc,
            prix: Number(dishPrix),
            categorie: dishCat
          })
        });
        if (res.ok) {
          await fetchDishesOnly();
          setIsDishModalOpen(false);
        }
      } else {
        const res = await fetch('/api/dishes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': currentUser.id
          },
          body: JSON.stringify({
            restaurant_id: currentRestaurant.id,
            nom: dishNom,
            description: dishDesc,
            prix: Number(dishPrix),
            categorie: dishCat
          })
        });
        if (res.ok) {
          await fetchDishesOnly();
          setIsDishModalOpen(false);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openAddDish = () => {
    setEditingDish(null);
    setDishNom('');
    setDishDesc('');
    setDishPrix('12.50');
    setDishCat('Plats');
    setIsDishModalOpen(true);
  };

  const openEditDish = (plat: Plat) => {
    setEditingDish(plat);
    setDishNom(plat.nom);
    setDishDesc(plat.description);
    setDishPrix(plat.prix.toString());
    setDishCat(plat.categorie);
    setIsDishModalOpen(true);
  };

  // Categories of orders
  const pendingOrders = orders.filter(o => o.statut === 'En attente du restaurant');
  const preparingOrders = orders.filter(o => o.statut === 'En préparation');
  const readyOrders = orders.filter(o => o.statut === 'Prête');
  const dispatchedOrders = orders.filter(o => o.statut === 'En livraison');
  const pastOrders = orders.filter(o => o.statut === 'Livrée' || o.statut === 'Refusée' || o.statut === 'Annulée');

  // KPI calculations
  const deliveredOrders = orders.filter(o => o.statut === 'Livrée');
  const totalCA = deliveredOrders.reduce((sum, o) => sum + o.total, 0);
  const avgBasket = deliveredOrders.length > 0 ? totalCA / deliveredOrders.length : 0;
  const refusalCount = orders.filter(o => o.statut === 'Refusée').length;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 pb-28 flex flex-col gap-6 min-h-screen">
      {/* Top Header */}
      <header className="bg-white rounded-2xl border border-[#E8E5DF] p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#F26A00] flex items-center justify-center text-white shrink-0 shadow-xs">
            <Store size={26} strokeWidth={2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-[#20201E]">
                {currentRestaurant?.nom || 'Mon Restaurant'}
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#E7F4EE] text-[#138A63]">
                Ouvert
              </span>
            </div>
            <p className="text-xs text-[#6B6B66]">
              Propriétaire : <strong>{currentUser?.prenom} {currentUser?.nom}</strong> · {currentRestaurant?.cuisine}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleManualRefresh}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E8E5DF] hover:bg-[#FFF8EE] text-xs font-semibold text-[#20201E] transition-colors"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-[#F26A00]' : ''} />
            <span>Actualiser</span>
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#F8D9BF] bg-[#FFF1E5] text-[#9E3E00] hover:bg-[#FCE3D2] text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut size={14} />
            <span>Déconnexion</span>
          </button>
        </div>
      </header>

      {/* TAB 1: COMMANDES */}
      {activeTab === 'commandes' && (
        <div className="flex flex-col gap-6">
          {/* SECTION A: COMMANDES À TRAITER (EN ATTENTE) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-extrabold text-[#9E3E00] uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F26A00] animate-pulse"></span>
                Commandes à traiter ({pendingOrders.length})
              </h2>
            </div>

            {pendingOrders.length === 0 ? (
              <div className="p-6 bg-white rounded-2xl border border-[#E8E5DF] text-center text-xs text-[#6B6B66]">
                Aucune nouvelle commande en attente pour le moment.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingOrders.map(order => (
                  <div
                    key={order.id}
                    className="bg-[#FFF1E5] border-2 border-[#F26A00] rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-[#9E3E00] text-sm">{order.id}</span>
                        <span className="text-xs text-[#6B6B66]">
                          {new Date(order.cree_a).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-[#20201E] mt-1">
                        Client : {order.client_nom}
                      </p>

                      {/* Items */}
                      <div className="my-2.5 p-2.5 bg-white/80 rounded-xl flex flex-col gap-1.5 text-xs">
                        {order.lignes?.map(l => (
                          <div key={l.id} className="flex justify-between font-medium">
                            <span><b>{l.quantite}x</b> {l.nom_plat_enregistre}</span>
                            <span>{l.total_ligne.toFixed(2)} €</span>
                          </div>
                        ))}
                      </div>

                      {order.instructions_livraison && (
                        <p className="text-[11px] text-[#6B6B66] italic mb-2">
                          Note : {order.instructions_livraison}
                        </p>
                      )}

                      <div className="text-xs font-extrabold text-[#20201E] flex justify-between">
                        <span>Total commande :</span>
                        <span className="text-[#C94F00]">{order.total.toFixed(2)} €</span>
                      </div>
                    </div>

                    {/* Actions Accepter / Refuser */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#F8D9BF]">
                      <button
                        type="button"
                        onClick={() => {
                          setOrderToRefuse(order);
                          setRefuseReason('');
                          setActionError(null);
                        }}
                        className="py-2.5 px-3 bg-white border border-red-300 text-[#D64545] hover:bg-red-50 text-xs font-bold rounded-xl transition-colors"
                      >
                        Refuser
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOrderToAccept(order);
                          setPrepTimeInput(20);
                          setActionError(null);
                        }}
                        className="py-2.5 px-3 bg-[#138A63] hover:bg-[#0f6e4f] text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
                      >
                        Accepter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION B: COMMANDES EN PRÉPARATION */}
          <div>
            <h2 className="text-sm font-extrabold text-[#20201E] uppercase tracking-wider mb-3">
              En préparation ({preparingOrders.length})
            </h2>

            {preparingOrders.length === 0 ? (
              <div className="p-6 bg-white rounded-2xl border border-[#E8E5DF] text-center text-xs text-[#6B6B66]">
                Aucune commande en cuisine actuellement.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {preparingOrders.map(order => (
                  <div
                    key={order.id}
                    className="bg-white border border-[#E8E5DF] rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-[#C94F00] text-sm">{order.id}</span>
                        <span className="text-xs bg-[#FFF1E5] text-[#C94F00] font-bold px-2.5 py-0.5 rounded-full">
                          ~{order.temps_preparation_min || 20} min
                        </span>
                      </div>
                      <p className="text-xs font-bold text-[#20201E] mt-1">
                        Client : {order.client_nom}
                      </p>

                      <div className="my-2.5 p-2 bg-[#FFFCF8] rounded-xl flex flex-col gap-1 text-xs">
                        {order.lignes?.map(l => (
                          <div key={l.id} className="flex justify-between">
                            <span>{l.quantite}x {l.nom_plat_enregistre}</span>
                            <span className="font-semibold">{l.total_ligne.toFixed(2)} €</span>
                          </div>
                        ))}
                      </div>

                      {/* Courier info if assigned */}
                      {order.livreur_nom ? (
                        <div className="p-2.5 bg-[#E7F4EE] border border-[#138A63]/20 rounded-xl flex items-center gap-2.5 text-xs">
                          <Bike size={18} className="text-[#138A63] shrink-0" />
                          <div>
                            <b className="text-[#138A63] font-bold">Livreur affecté : {order.livreur_nom}</b>
                            <span className="block text-[11px] text-[#138A63]/80">
                              Mission acceptée par le livreur · En attente de retrait
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2.5 bg-[#FFF7ED] border border-[#F26A00]/25 rounded-xl flex items-center gap-2.5 text-xs">
                          <Clock size={18} className="text-[#F26A00] shrink-0 animate-pulse" />
                          <div>
                            <b className="text-[#C94F00] font-bold">En attente d’un livreur</b>
                            <span className="block text-[11px] text-[#8C3700]">
                              Mission disponible sur l’application livreurs (non attribuée)
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleMarkReady(order.id)}
                      className="w-full py-2.5 bg-[#F26A00] hover:bg-[#C94F00] text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
                    >
                      Commande prête pour retrait
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION C: COMMANDES PRÊTES & EXPÉDIÉES */}
          <div>
            <h2 className="text-sm font-extrabold text-[#20201E] uppercase tracking-wider mb-3">
              Prêtes & En livraison ({readyOrders.length + dispatchedOrders.length})
            </h2>

            {readyOrders.length === 0 && dispatchedOrders.length === 0 ? (
              <div className="p-6 bg-white rounded-2xl border border-[#E8E5DF] text-center text-xs text-[#6B6B66]">
                Aucune commande prête en attente de coursier.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...readyOrders, ...dispatchedOrders].map(order => (
                  <div
                    key={order.id}
                    className="bg-white border border-[#E8E5DF] rounded-2xl p-4 flex flex-col gap-2 text-xs shadow-2xs"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#20201E]">{order.id} — {order.client_nom}</span>
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        order.statut === 'Prête' ? 'bg-blue-100 text-blue-800' : 'bg-[#E7F4EE] text-[#138A63]'
                      }`}>
                        {order.statut}
                      </span>
                    </div>
                    <p className="text-[#6B6B66]">
                      {order.lignes?.map(l => `${l.quantite}x ${l.nom_plat_enregistre}`).join(', ')}
                    </p>
                    <div className="pt-2 border-t border-[#E8E5DF] flex justify-between items-center text-[#20201E]">
                      <span>Livreur : <b>{order.livreur_nom || 'Non attribué'}</b></span>
                      <span className="font-extrabold text-[#C94F00]">{order.total.toFixed(2)} €</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION D: COMMANDES PASSÉES / LIVRÉES */}
          {pastOrders.length > 0 && (
            <div>
              <h2 className="text-sm font-extrabold text-[#6B6B66] uppercase tracking-wider mb-3">
                Historique ({pastOrders.length})
              </h2>
              <div className="bg-white rounded-2xl border border-[#E8E5DF] divide-y divide-[#E8E5DF] text-xs">
                {pastOrders.slice(0, 10).map(order => (
                  <div key={order.id} className="p-3.5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#20201E]">{order.id}</span>
                        <span className="text-[#6B6B66]">{order.client_nom}</span>
                        <span className="text-[#6B6B66]">({new Date(order.cree_a).toLocaleDateString('fr-FR')})</span>
                      </div>
                      <p className="text-[#6B6B66] mt-0.5 line-clamp-1">
                        {order.lignes?.map(l => `${l.quantite}x ${l.nom_plat_enregistre}`).join(', ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        order.statut === 'Livrée' ? 'bg-[#E7F4EE] text-[#138A63]' : 'bg-red-100 text-red-800'
                      }`}>
                        {order.statut}
                      </span>
                      <span className="font-bold text-[#20201E]">
                        {order.total.toFixed(2)} €
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MA CARTE */}
      {activeTab === 'carte' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-[#20201E]">Carte du restaurant</h2>
              <p className="text-xs text-[#6B6B66]">Gérez les plats, descriptions, prix et disponibilités</p>
            </div>
            <button
              type="button"
              onClick={openAddDish}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#F26A00] hover:bg-[#C94F00] text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
            >
              <Plus size={16} />
              <span>Ajouter un plat</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {plats.map(plat => (
              <div
                key={plat.id}
                className="bg-white rounded-2xl border border-[#E8E5DF] p-4 flex gap-3.5 items-center justify-between shadow-2xs"
              >
                <img
                  src={plat.image_url || currentRestaurant?.photo}
                  alt={plat.nom}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-xl object-cover shrink-0 border border-[#E8E5DF]"
                />
                <div className="grow min-w-0">
                  <div className="flex items-center gap-2">
                    <b className="text-sm font-bold text-[#20201E] truncate">{plat.nom}</b>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FFF1E5] text-[#9E3E00] font-semibold">
                      {plat.categorie}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B6B66] line-clamp-1 mt-0.5">{plat.description}</p>
                  <span className="text-xs font-extrabold text-[#C94F00] mt-1 block">
                    {plat.prix.toFixed(2).replace('.', ',')} €
                  </span>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleDish(plat)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                      plat.disponible
                        ? 'bg-[#E7F4EE] border-[#BCE1D1] text-[#138A63]'
                        : 'bg-gray-100 border-gray-300 text-gray-600'
                    }`}
                  >
                    {plat.disponible ? 'Disponible' : 'Indisponible'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditDish(plat)}
                    className="text-xs text-[#C94F00] font-semibold hover:underline"
                  >
                    Modifier
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: ACTIVITÉ */}
      {activeTab === 'activite' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#20201E]">Activité & Performances</h2>
              <p className="text-xs text-[#6B6B66]">Chiffres calculés directement sur vos commandes réelles</p>
            </div>
            <div className="flex gap-1 p-1 bg-white border border-[#E8E5DF] rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setActivityPeriod('jour')}
                className={`px-3 py-1 rounded-lg font-semibold ${
                  activityPeriod === 'jour' ? 'bg-[#F26A00] text-white' : 'text-[#6B6B66]'
                }`}
              >
                Aujourd'hui
              </button>
              <button
                type="button"
                onClick={() => setActivityPeriod('semaine')}
                className={`px-3 py-1 rounded-lg font-semibold ${
                  activityPeriod === 'semaine' ? 'bg-[#F26A00] text-white' : 'text-[#6B6B66]'
                }`}
              >
                7 jours
              </button>
              <button
                type="button"
                onClick={() => setActivityPeriod('mois')}
                className={`px-3 py-1 rounded-lg font-semibold ${
                  activityPeriod === 'mois' ? 'bg-[#F26A00] text-white' : 'text-[#6B6B66]'
                }`}
              >
                Mois
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-[#E8E5DF] p-4 shadow-2xs">
              <span className="text-xs font-semibold text-[#6B6B66]">Chiffre d'Affaires</span>
              <p className="text-2xl font-extrabold text-[#C94F00] mt-1">
                {totalCA.toFixed(2).replace('.', ',')} €
              </p>
              <span className="text-[11px] text-[#138A63] font-medium">Commandes livrées</span>
            </div>

            <div className="bg-white rounded-2xl border border-[#E8E5DF] p-4 shadow-2xs">
              <span className="text-xs font-semibold text-[#6B6B66]">Commandes livrées</span>
              <p className="text-2xl font-extrabold text-[#20201E] mt-1">
                {deliveredOrders.length}
              </p>
              <span className="text-[11px] text-[#6B6B66]">Total traitées</span>
            </div>

            <div className="bg-white rounded-2xl border border-[#E8E5DF] p-4 shadow-2xs">
              <span className="text-xs font-semibold text-[#6B6B66]">Panier Moyen</span>
              <p className="text-2xl font-extrabold text-[#20201E] mt-1">
                {avgBasket.toFixed(2).replace('.', ',')} €
              </p>
              <span className="text-[11px] text-[#6B6B66]">Par client</span>
            </div>

            <div className="bg-white rounded-2xl border border-[#E8E5DF] p-4 shadow-2xs">
              <span className="text-xs font-semibold text-[#6B6B66]">Commandes refusées</span>
              <p className="text-2xl font-extrabold text-[#D64545] mt-1">
                {refusalCount}
              </p>
              <span className="text-[11px] text-[#D64545] font-medium">Motifs enregistrés</span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ACCEPTER */}
      {orderToAccept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#FFFCF8] rounded-2xl border border-[#E8E5DF] p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-bold text-[#20201E] mb-1">
              Accepter la commande {orderToAccept.id}
            </h3>
            <p className="text-xs text-[#6B6B66] mb-4">
              Indiquez le temps de préparation estimé avant retrait par le livreur.
            </p>

            {actionError && (
              <div className="p-2 mb-3 bg-red-50 text-red-700 text-xs rounded-lg">
                {actionError}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#20201E] mb-1">
                Temps estimé (minutes)
              </label>
              <div className="flex gap-2">
                {[15, 20, 25, 30].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPrepTimeInput(m)}
                    className={`grow py-2 rounded-xl text-xs font-bold border transition-colors ${
                      prepTimeInput === m
                        ? 'bg-[#F26A00] text-white border-[#F26A00]'
                        : 'bg-white text-[#20201E] border-[#E8E5DF]'
                    }`}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOrderToAccept(null)}
                className="grow py-2.5 bg-white border border-[#E8E5DF] text-xs font-semibold rounded-xl"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmAccept}
                className="grow py-2.5 bg-[#138A63] hover:bg-[#0f6e4f] text-white text-xs font-bold rounded-xl disabled:opacity-50"
              >
                {actionLoading ? 'Validation…' : 'Confirmer en cuisine'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REFUSER */}
      {orderToRefuse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#FFFCF8] rounded-2xl border border-[#E8E5DF] p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-bold text-[#D64545] mb-1">
              Refuser la commande {orderToRefuse.id}
            </h3>
            <p className="text-xs text-[#6B6B66] mb-3">
              Un motif est obligatoire pour informer le client et le service support.
            </p>

            {actionError && (
              <div className="p-2 mb-3 bg-red-50 text-red-700 text-xs rounded-lg">
                {actionError}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#20201E] mb-1">
                Motif de refus
              </label>
              <textarea
                rows={3}
                required
                value={refuseReason}
                onChange={(e) => setRefuseReason(e.target.value)}
                placeholder="Rupture d'ingrédient, coupure d'énergie, affluence maximale..."
                className="w-full p-2.5 border border-[#E8E5DF] rounded-xl text-xs bg-white text-[#20201E] focus:outline-none focus:border-[#D64545]"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOrderToRefuse(null)}
                className="grow py-2.5 bg-white border border-[#E8E5DF] text-xs font-semibold rounded-xl"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmRefuse}
                className="grow py-2.5 bg-[#D64545] hover:bg-red-700 text-white text-xs font-bold rounded-xl disabled:opacity-50"
              >
                {actionLoading ? 'Refus en cours…' : 'Confirmer le refus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AJOUT / ÉDITION PLAT */}
      {isDishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#FFFCF8] rounded-2xl border border-[#E8E5DF] p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-[#E8E5DF] mb-4">
              <h3 className="text-base font-bold text-[#20201E]">
                {editingDish ? 'Modifier le plat' : 'Ajouter un plat à la carte'}
              </h3>
              <button
                type="button"
                onClick={() => setIsDishModalOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center border border-[#E8E5DF]"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveDish} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#20201E] mb-1">Nom du plat</label>
                <input
                  type="text"
                  required
                  value={dishNom}
                  onChange={(e) => setDishNom(e.target.value)}
                  placeholder="Ex. Gnocchis à la crème de truffe"
                  className="w-full px-3 py-2 border border-[#E8E5DF] rounded-xl text-xs bg-white text-[#20201E] focus:outline-none focus:border-[#F26A00]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#20201E] mb-1">Prix (€)</label>
                  <input
                    type="number"
                    step="0.10"
                    required
                    value={dishPrix}
                    onChange={(e) => setDishPrix(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E8E5DF] rounded-xl text-xs bg-white text-[#20201E] focus:outline-none focus:border-[#F26A00]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#20201E] mb-1">Catégorie</label>
                  <select
                    value={dishCat}
                    onChange={(e) => setDishCat(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E8E5DF] rounded-xl text-xs bg-white text-[#20201E] focus:outline-none focus:border-[#F26A00]"
                  >
                    <option value="Plats">Plats</option>
                    <option value="Entrées">Entrées</option>
                    <option value="Desserts">Desserts</option>
                    <option value="Boissons">Boissons</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#20201E] mb-1">Description</label>
                <textarea
                  rows={2}
                  value={dishDesc}
                  onChange={(e) => setDishDesc(e.target.value)}
                  placeholder="Ingrédients frais, préparation maison..."
                  className="w-full px-3 py-2 border border-[#E8E5DF] rounded-xl text-xs bg-white text-[#20201E] focus:outline-none focus:border-[#F26A00]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsDishModalOpen(false)}
                  className="grow py-2.5 bg-white border border-[#E8E5DF] text-xs font-semibold rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="grow py-2.5 bg-[#F26A00] hover:bg-[#C94F00] text-white text-xs font-bold rounded-xl"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation (COMMANDES - PLATS - ACTIVITE) */}
      <RestaurateurBottomNav
        activeTab={activeTab === 'carte' || activeTab === 'activite' ? activeTab : 'commandes'}
        onChangeTab={(tab) => setActiveTab(tab)}
        ordersCount={pendingOrders.length + preparingOrders.length}
        dishesCount={plats.length}
      />
    </div>
  );
};
