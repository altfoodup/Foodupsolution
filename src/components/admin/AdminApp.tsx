import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Commande, Signalement, Utilisateur } from '../../types.js';
import { AdminBottomNav } from './AdminBottomNav.js';
import { 
  ShieldCheck, 
  Activity, 
  Package, 
  AlertTriangle, 
  Users, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Clock, 
  DollarSign, 
  Bike, 
  Store, 
  Search,
  MessageSquare,
  LogOut
} from 'lucide-react';

export const AdminApp: React.FC = () => {
  const { currentUser, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'commandes' | 'incidents' | 'partenaires'>('dashboard');

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [orders, setOrders] = useState<Commande[]>([]);
  const [reports, setReports] = useState<Signalement[]>([]);
  const [users, setUsers] = useState<Utilisateur[]>([]);

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Incident resolution modal
  const [selectedReport, setSelectedReport] = useState<Signalement | null>(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [resolveLoading, setResolveLoading] = useState(false);

  // Partner validation modal (Refuse)
  const [partnerToRefuse, setPartnerToRefuse] = useState<Utilisateur | null>(null);
  const [partnerRefuseReason, setPartnerRefuseReason] = useState('');
  const [partnerLoading, setPartnerLoading] = useState(false);

  // Fiche détaillée d'un partenaire (restaurateur ou livreur)
  const [selectedPartner, setSelectedPartner] = useState<any | null>(null);
  const [partnerRestaurant, setPartnerRestaurant] = useState<any | null>(null);
  const [partnerDishCount, setPartnerDishCount] = useState<number>(0);

  const openPartner = async (p: any) => {
    setSelectedPartner(p);
    setPartnerRestaurant(null);
    setPartnerDishCount(0);
    if (p.role === 'Restaurateur' && p.restaurant_id) {
      try {
        const res = await fetch(`/api/restaurants/${p.restaurant_id}`);
        if (res.ok) {
          const data = await res.json();
          setPartnerRestaurant(data.restaurant);
          setPartnerDishCount((data.plats || []).length);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Filters
  const [orderFilter, setOrderFilter] = useState<string>('Tous');
  const [reportFilter, setReportFilter] = useState<string>('Tous');

  useEffect(() => {
    fetchAllAdminData();
    const interval = setInterval(fetchAllAdminData, 12000);
    return () => clearInterval(interval);
  }, []);

  const fetchAllAdminData = async () => {
    try {
      await Promise.all([
        fetchDashboard(),
        fetchOrders(),
        fetchReports(),
        fetchUsers()
      ]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchDashboard = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: { 'x-user-id': currentUser.id }
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchOrders = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/orders', {
        headers: { 'x-user-id': currentUser.id }
      });
      if (res.ok) setOrders(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchReports = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/reports', {
        headers: { 'x-user-id': currentUser.id }
      });
      if (res.ok) setReports(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/personas');
      if (res.ok) setUsers(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchAllAdminData();
  };

  // Transaction: Resolve Incident
  const handleResolveReport = async () => {
    if (!selectedReport || !currentUser) return;
    setResolveLoading(true);
    try {
      const res = await fetch(`/api/reports/${selectedReport.id}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({ reponse_admin: adminResponse.trim() })
      });
      if (res.ok) {
        setSelectedReport(null);
        setAdminResponse('');
        fetchAllAdminData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setResolveLoading(false);
    }
  };

  // Transaction: Validate Partner (Accept)
  const handleAcceptPartner = async (partnerId: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({ decision: 'Accepté' })
      });
      if (res.ok) fetchAllAdminData();
    } catch (e) {
      console.error(e);
    }
  };

  // Transaction: Refuse Partner (with mandatory reason)
  const handleConfirmRefusePartner = async () => {
    if (!partnerToRefuse || !currentUser) return;
    if (!partnerRefuseReason.trim()) {
      alert('Un motif est obligatoire pour refuser un dossier.');
      return;
    }
    setPartnerLoading(true);
    try {
      const res = await fetch(`/api/admin/partners/${partnerToRefuse.id}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({
          decision: 'Refusé',
          motif: partnerRefuseReason.trim()
        })
      });
      if (res.ok) {
        setPartnerToRefuse(null);
        setPartnerRefuseReason('');
        fetchAllAdminData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPartnerLoading(false);
    }
  };

  const kpis = dashboardData?.kpi || {
    commandesEnCours: 0,
    incidentsATraiter: 0,
    livraisonsAujourdhui: 0,
    caJour: 0,
    caMois: 0,
    commandesMois: 0,
    panierMoyen: 0,
    livreursActifs: 0
  };

  const filteredOrders = orders.filter(o => {
    if (orderFilter === 'Tous') return true;
    return o.statut === orderFilter;
  });

  const filteredReports = reports.filter(r => {
    if (reportFilter === 'Tous') return true;
    return r.statut === reportFilter;
  });

  const partners = users.filter(u => u.role === 'Restaurateur' || u.role === 'Livreur');

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 pb-28 flex flex-col gap-6 min-h-screen">
      {/* Header */}
      <header className="bg-white rounded-2xl border border-[#E8E5DF] p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#20201E] flex items-center justify-center text-white shrink-0 shadow-xs">
            <ShieldCheck size={28} className="text-[#F26A00]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-[#20201E]">
                Supervision FoodUp
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FFF1E5] text-[#9E3E00]">
                Admin
              </span>
            </div>
            <p className="text-xs text-[#6B6B66]">
              Opérations gérées par <strong>{currentUser?.prenom} {currentUser?.nom}</strong>
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

      {/* TAB 1: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="flex flex-col gap-6">
          {/* 8 Operational KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-[#E8E5DF] p-4 shadow-2xs">
              <span className="text-[11px] font-semibold text-[#6B6B66]">Commandes en cours</span>
              <p className="text-2xl font-extrabold text-[#C94F00] mt-1">{kpis.commandesEnCours}</p>
              <span className="text-[10px] text-[#6B6B66]">Attente, prépa, livraison</span>
            </div>

            <div className="bg-white rounded-2xl border border-[#E8E5DF] p-4 shadow-2xs">
              <span className="text-[11px] font-semibold text-[#6B6B66]">Incidents à traiter</span>
              <p className="text-2xl font-extrabold text-[#D64545] mt-1">{kpis.incidentsATraiter}</p>
              <span className="text-[10px] text-[#D64545] font-semibold">Action requise</span>
            </div>

            <div className="bg-white rounded-2xl border border-[#E8E5DF] p-4 shadow-2xs">
              <span className="text-[11px] font-semibold text-[#6B6B66]">Livraisons aujourd'hui</span>
              <p className="text-2xl font-extrabold text-[#138A63] mt-1">{kpis.livraisonsAujourdhui}</p>
              <span className="text-[10px] text-[#138A63] font-semibold">Livrées</span>
            </div>

            <div className="bg-white rounded-2xl border border-[#E8E5DF] p-4 shadow-2xs">
              <span className="text-[11px] font-semibold text-[#6B6B66]">CA du jour</span>
              <p className="text-2xl font-extrabold text-[#20201E] mt-1">{kpis.caJour.toFixed(2)} €</p>
              <span className="text-[10px] text-[#6B6B66]">Volume total payé</span>
            </div>

            <div className="bg-white rounded-2xl border border-[#E8E5DF] p-4 shadow-2xs">
              <span className="text-[11px] font-semibold text-[#6B6B66]">CA du mois</span>
              <p className="text-2xl font-extrabold text-[#20201E] mt-1">{kpis.caMois.toFixed(2)} €</p>
              <span className="text-[10px] text-[#6B6B66]">Mois en cours</span>
            </div>

            <div className="bg-white rounded-2xl border border-[#E8E5DF] p-4 shadow-2xs">
              <span className="text-[11px] font-semibold text-[#6B6B66]">Commandes du mois</span>
              <p className="text-2xl font-extrabold text-[#20201E] mt-1">{kpis.commandesMois}</p>
              <span className="text-[10px] text-[#6B6B66]">Total livrées</span>
            </div>

            <div className="bg-white rounded-2xl border border-[#E8E5DF] p-4 shadow-2xs">
              <span className="text-[11px] font-semibold text-[#6B6B66]">Panier moyen</span>
              <p className="text-2xl font-extrabold text-[#20201E] mt-1">{kpis.panierMoyen.toFixed(2)} €</p>
              <span className="text-[10px] text-[#6B6B66]">Par commande</span>
            </div>

            <div className="bg-white rounded-2xl border border-[#E8E5DF] p-4 shadow-2xs">
              <span className="text-[11px] font-semibold text-[#6B6B66]">Livreurs actifs</span>
              <p className="text-2xl font-extrabold text-[#138A63] mt-1">{kpis.livreursActifs}</p>
              <span className="text-[10px] text-[#138A63] font-semibold">Disponibles</span>
            </div>
          </div>

          {/* Quick Monitor: Live Orders & Incidents */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-[#E8E5DF] p-4 flex flex-col gap-3">
              <h2 className="text-xs font-bold text-[#20201E] uppercase tracking-wider flex items-center gap-1.5">
                <Package size={14} className="text-[#F26A00]" />
                Commandes actives en direct
              </h2>

              {dashboardData?.commandesEnCoursList?.length === 0 ? (
                <p className="text-xs text-[#6B6B66] py-4 text-center">Aucune commande en cours.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {dashboardData?.commandesEnCoursList?.map((o: Commande) => (
                    <div key={o.id} className="p-2.5 bg-[#FFFCF8] border border-[#E8E5DF] rounded-xl flex justify-between items-center text-xs">
                      <div>
                        <b>{o.id}</b> — {o.restaurant_nom}
                        <p className="text-[11px] text-[#6B6B66]">{o.client_nom} · {o.total.toFixed(2)} €</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-[#FFF1E5] text-[#9E3E00]">
                        {o.statut}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-[#E8E5DF] p-4 flex flex-col gap-3">
              <h2 className="text-xs font-bold text-[#20201E] uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-[#D64545]" />
                Derniers signalements clients
              </h2>

              {reports.filter(r => r.statut !== 'Résolu').length === 0 ? (
                <p className="text-xs text-[#138A63] py-4 text-center font-medium">
                  ✓ Aucun incident en attente de traitement.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {reports.filter(r => r.statut !== 'Résolu').slice(0, 4).map(r => (
                    <div key={r.id} className="p-2.5 bg-red-50/70 border border-red-200 rounded-xl flex justify-between items-center text-xs">
                      <div>
                        <b className="text-red-900">{r.type}</b> — {r.commande_id}
                        <p className="text-[11px] text-red-800 line-clamp-1">{r.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReport(r);
                          setAdminResponse('');
                        }}
                        className="px-2.5 py-1 bg-[#D64545] text-white font-bold rounded-lg text-[10px]"
                      >
                        Traiter
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COMMANDES */}
      {activeTab === 'commandes' && (
        <div className="bg-white rounded-2xl border border-[#E8E5DF] p-5 flex flex-col gap-4 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[#20201E]">Toutes les commandes</h2>

            {/* Filter buttons */}
            <div className="flex flex-wrap gap-1 text-xs">
              {['Tous', 'En attente du restaurant', 'En préparation', 'Prête', 'En livraison', 'Livrée', 'Refusée'].map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setOrderFilter(f)}
                  className={`px-3 py-1 rounded-lg border font-semibold ${
                    orderFilter === f ? 'bg-[#20201E] text-white border-[#20201E]' : 'bg-white border-[#E8E5DF] text-[#6B6B66]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#FFFCF8] border-b border-[#E8E5DF] text-[#6B6B66]">
                <tr>
                  <th className="py-2.5 px-3">Réf</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Client</th>
                  <th className="py-2.5 px-3">Restaurant</th>
                  <th className="py-2.5 px-3">Livreur</th>
                  <th className="py-2.5 px-3">Total</th>
                  <th className="py-2.5 px-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E5DF]">
                {filteredOrders.map(o => (
                  <tr key={o.id} className="hover:bg-[#FFF8EE]/40">
                    <td className="py-2.5 px-3 font-bold text-[#20201E]">{o.id}</td>
                    <td className="py-2.5 px-3 text-[#6B6B66]">{new Date(o.cree_a).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="py-2.5 px-3 font-medium">{o.client_nom}</td>
                    <td className="py-2.5 px-3">{o.restaurant_nom}</td>
                    <td className="py-2.5 px-3 text-[#6B6B66]">{o.livreur_nom || '—'}</td>
                    <td className="py-2.5 px-3 font-extrabold text-[#C94F00]">{o.total.toFixed(2)} €</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        o.statut === 'Livrée' ? 'bg-[#E7F4EE] text-[#138A63]' :
                        o.statut === 'Refusée' ? 'bg-red-100 text-red-800' :
                        'bg-[#FFF1E5] text-[#C94F00]'
                      }`}>
                        {o.statut}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: INCIDENTS */}
      {activeTab === 'incidents' && (
        <div className="bg-white rounded-2xl border border-[#E8E5DF] p-5 flex flex-col gap-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#20201E]">Gestion des signalements</h2>
            <div className="flex gap-1 text-xs">
              {['Tous', 'Nouveau', 'Résolu'].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setReportFilter(s)}
                  className={`px-3 py-1 rounded-lg border font-semibold ${
                    reportFilter === s ? 'bg-[#20201E] text-white border-[#20201E]' : 'bg-white border-[#E8E5DF] text-[#6B6B66]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {filteredReports.map(r => (
              <div key={r.id} className="p-4 bg-[#FFFCF8] rounded-xl border border-[#E8E5DF] flex flex-col gap-2.5 text-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-extrabold text-[#D64545] text-sm">{r.type}</span>
                    <span className="text-[#6B6B66] ml-2">Commande : <b>{r.commande_id}</b> ({r.auteur_nom})</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                    r.statut === 'Résolu' ? 'bg-[#E7F4EE] text-[#138A63]' : 'bg-red-100 text-red-800'
                  }`}>
                    {r.statut}
                  </span>
                </div>

                <p className="text-[#20201E]">{r.description}</p>

                {r.reponse_admin ? (
                  <div className="p-2.5 bg-[#E7F4EE] rounded-lg text-[#138A63]">
                    <b>Réponse apportée :</b> {r.reponse_admin}
                  </div>
                ) : (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReport(r);
                        setAdminResponse('');
                      }}
                      className="px-3.5 py-1.5 bg-[#20201E] hover:bg-black text-white text-xs font-bold rounded-xl"
                    >
                      Traiter et répondre au client
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: PARTENAIRES (VALIDATION WORKFLOW) */}
      {activeTab === 'partenaires' && (
        <div className="bg-white rounded-2xl border border-[#E8E5DF] p-5 flex flex-col gap-4 shadow-2xs">
          <div>
            <h2 className="text-base font-bold text-[#20201E]">Partenaires (Restaurateurs & Livreurs)</h2>
            <p className="text-xs text-[#6B6B66]">Validation des comptes avant activation sur la plateforme</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#FFFCF8] border-b border-[#E8E5DF] text-[#6B6B66]">
                <tr>
                  <th className="py-2.5 px-3">Nom</th>
                  <th className="py-2.5 px-3">Rôle</th>
                  <th className="py-2.5 px-3">Email & Contact</th>
                  <th className="py-2.5 px-3">Statut validation</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E5DF]">
                {partners.map(p => (
                  <tr key={p.id} className="hover:bg-[#FFF8EE]/40">
                    <td
                      className="py-2.5 px-3 font-bold text-[#20201E] cursor-pointer hover:text-[#C94F00]"
                      onClick={() => openPartner(p)}
                      title="Voir la fiche détaillée"
                    >
                      {p.prenom} {p.nom} <span className="text-[10px] font-semibold text-[#C94F00] underline">Voir la fiche</span>
                      {p.moyen_deplacement && <span className="block text-[11px] font-normal text-[#6B6B66]">{p.moyen_deplacement}</span>}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-[#20201E]">{p.role}</span>
                    </td>
                    <td className="py-2.5 px-3 text-[#6B6B66]">{p.email}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        p.statut_validation === 'Accepté' ? 'bg-[#E7F4EE] text-[#138A63]' :
                        p.statut_validation === 'Refusé' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {p.statut_validation}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {p.statut_validation === 'En attente' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAcceptPartner(p.id)}
                            className="px-2.5 py-1 bg-[#138A63] text-white text-[11px] font-bold rounded-lg hover:bg-[#0f6e4f]"
                          >
                            Accepter
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPartnerToRefuse(p);
                              setPartnerRefuseReason('');
                            }}
                            className="px-2.5 py-1 bg-red-100 text-red-800 text-[11px] font-bold rounded-lg hover:bg-red-200"
                          >
                            Refuser
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#6B6B66]">Traité</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL FICHE PARTENAIRE */}
      {selectedPartner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setSelectedPartner(null)}
        >
          <div
            className="bg-[#FFFCF8] rounded-2xl border border-[#E8E5DF] p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-xs font-bold text-[#C94F00]">{selectedPartner.id} · {selectedPartner.role}</span>
                <h3 className="text-lg font-bold text-[#20201E]">{selectedPartner.prenom} {selectedPartner.nom}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPartner(null)}
                className="w-8 h-8 rounded-full border border-[#E8E5DF] text-[#6B6B66] hover:text-[#20201E]"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2 text-xs">
              <div className="p-3 bg-white border border-[#E8E5DF] rounded-xl flex flex-col gap-1">
                <span className="font-bold text-[#6B6B66] uppercase text-[10px]">Coordonnées</span>
                <span>📧 {selectedPartner.email || '—'}</span>
                <span>📞 {selectedPartner.telephone || '—'}</span>
                <span>📍 {selectedPartner.adresse || '—'}</span>
              </div>

              <div className="p-3 bg-white border border-[#E8E5DF] rounded-xl flex flex-col gap-1">
                <span className="font-bold text-[#6B6B66] uppercase text-[10px]">Validation</span>
                <span>Statut : <b>{selectedPartner.statut_validation}</b></span>
                <span>Compte actif : <b>{selectedPartner.compte_actif ? 'Oui' : 'Non'}</b></span>
                {selectedPartner.date_decision && (
                  <span>Date de décision : {new Date(selectedPartner.date_decision).toLocaleString('fr-FR')}</span>
                )}
                {selectedPartner.motif_decision && <span>Motif : {selectedPartner.motif_decision}</span>}
              </div>

              {selectedPartner.role === 'Livreur' && (
                <div className="p-3 bg-[#E7F4EE] border border-[#BCE1D1] rounded-xl flex flex-col gap-1">
                  <span className="font-bold text-[#138A63] uppercase text-[10px]">Livreur</span>
                  <span>Moyen de transport : <b>{selectedPartner.moyen_deplacement || '—'}</b></span>
                  <span>Zone de livraison : <b>{selectedPartner.zone_livraison || '—'}</b></span>
                  <span>Disponible : <b>{selectedPartner.disponible_livraison ? 'Oui' : 'Non'}</b></span>
                </div>
              )}

              {selectedPartner.role === 'Restaurateur' && (
                <div className="p-3 bg-[#FFF8EE] border border-[#F8D9BF] rounded-xl flex flex-col gap-1">
                  <span className="font-bold text-[#9E3E00] uppercase text-[10px]">Restaurant</span>
                  {partnerRestaurant ? (
                    <>
                      <b className="text-sm">{partnerRestaurant.nom} ({partnerRestaurant.id})</b>
                      <span>Cuisine : {partnerRestaurant.cuisine}</span>
                      <span>Adresse : {partnerRestaurant.adresse}</span>
                      <span>Quartier : {partnerRestaurant.quartier}</span>
                      <span>Frais de livraison : {Number(partnerRestaurant.frais_livraison).toFixed(2).replace('.', ',')} €</span>
                      <span>Délai : {partnerRestaurant.delai}</span>
                      <span>Plats à la carte : {partnerDishCount}</span>
                    </>
                  ) : (
                    <span className="text-[#6B6B66]">
                      {selectedPartner.restaurant_nom || 'Aucun restaurant rattaché'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL TRAITER INCIDENT */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#FFFCF8] rounded-2xl border border-[#E8E5DF] p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-[#20201E] mb-1">
              Résoudre l'incident {selectedReport.id}
            </h3>
            <p className="text-xs text-[#6B6B66] mb-3">
              Commande : <strong>{selectedReport.commande_id}</strong> · Motif : {selectedReport.type}
            </p>
            <div className="p-2.5 bg-white border border-[#E8E5DF] rounded-xl text-xs mb-3 text-[#20201E]">
              {selectedReport.description}
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#20201E] mb-1">
                Réponse officielle / Mesure prise
              </label>
              <textarea
                rows={3}
                required
                value={adminResponse}
                onChange={(e) => setAdminResponse(e.target.value)}
                placeholder="Ex. Remboursement accordé sous 24h, excuses auprès du client et avertissement au coursier."
                className="w-full p-2.5 border border-[#E8E5DF] rounded-xl text-xs bg-white text-[#20201E] focus:outline-none focus:border-[#F26A00]"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="grow py-2.5 bg-white border border-[#E8E5DF] text-xs font-semibold rounded-xl"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={resolveLoading}
                onClick={handleResolveReport}
                className="grow py-2.5 bg-[#138A63] hover:bg-[#0f6e4f] text-white text-xs font-bold rounded-xl disabled:opacity-50"
              >
                {resolveLoading ? 'Traitement…' : 'Valider la résolution'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REFUSER PARTENAIRE */}
      {partnerToRefuse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#FFFCF8] rounded-2xl border border-[#E8E5DF] p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-bold text-[#D64545] mb-1">
              Refuser le partenaire
            </h3>
            <p className="text-xs text-[#6B6B66] mb-3">
              {partnerToRefuse.prenom} {partnerToRefuse.nom} ({partnerToRefuse.role})
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#20201E] mb-1">
                Motif obligatoire du refus
              </label>
              <textarea
                rows={3}
                required
                value={partnerRefuseReason}
                onChange={(e) => setPartnerRefuseReason(e.target.value)}
                placeholder="Zone de chalandise non couverte, documents manquants..."
                className="w-full p-2.5 border border-[#E8E5DF] rounded-xl text-xs bg-white text-[#20201E] focus:outline-none focus:border-[#D64545]"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPartnerToRefuse(null)}
                className="grow py-2.5 bg-white border border-[#E8E5DF] text-xs font-semibold rounded-xl"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={partnerLoading}
                onClick={handleConfirmRefusePartner}
                className="grow py-2.5 bg-[#D64545] text-white text-xs font-bold rounded-xl disabled:opacity-50"
              >
                {partnerLoading ? 'Traitement…' : 'Confirmer le refus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation (TABLEAU DE BORD - COMMANDES - INCIDENTS - PARTENAIRES) */}
      <AdminBottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        ordersCount={orders.length}
        incidentsCount={kpis.incidentsATraiter}
      />
    </div>
  );
};
