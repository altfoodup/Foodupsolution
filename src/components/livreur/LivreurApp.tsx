import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { MissionLivraison, Commande } from '../../types.js';
import { 
  Bike, 
  MapPin, 
  Store, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  Power, 
  AlertCircle,
  Navigation,
  Check,
  MessageSquareWarning,
  LogOut
} from 'lucide-react';
import { ReportModal } from '../client/ReportModal.js';
import { LivreurBottomNav } from './LivreurBottomNav.js';

export const LivreurApp: React.FC = () => {
  const { currentUser, refreshUser, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<'disponibles' | 'active' | 'gains' | 'profil'>('disponibles');
  const [availableMissions, setAvailableMissions] = useState<MissionLivraison[]>([]);
  const [activeMission, setActiveMission] = useState<MissionLivraison | null>(null);
  const [earnings, setEarnings] = useState({
    gainsJour: 0,
    gainsSemaine: 0,
    gainsMois: 0,
    nombreMissionsTerminees: 0
  });

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reportModalOrder, setReportModalOrder] = useState<string | null>(null);

  useEffect(() => {
    fetchCourierData();
    const interval = setInterval(fetchCourierData, 8000);
    return () => clearInterval(interval);
  }, [currentUser?.id, currentUser?.disponible_livraison]);

  const fetchCourierData = async () => {
    if (!currentUser) return;
    try {
      await Promise.all([
        fetchAvailableMissions(),
        fetchActiveMission(),
        fetchEarnings()
      ]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchAvailableMissions = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/missions/available', {
        headers: { 'x-user-id': currentUser.id }
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableMissions(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchActiveMission = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/missions/active', {
        headers: { 'x-user-id': currentUser.id }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveMission(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEarnings = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/courier/earnings', {
        headers: { 'x-user-id': currentUser.id }
      });
      if (res.ok) {
        const data = await res.json();
        setEarnings(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchCourierData();
  };

  // Toggle courier availability (strictly touches disponible_livraison, NOT compte_actif)
  const handleToggleAvailability = async () => {
    if (!currentUser) return;
    try {
      const nextState = !currentUser.disponible_livraison;
      const res = await fetch('/api/courier/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({ disponible: nextState })
      });
      if (res.ok) {
        await refreshUser();
        fetchCourierData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Courier accepts available mission
  const handleAcceptMission = async (missionId: string) => {
    if (!currentUser) return;
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/missions/${missionId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de l’attribution de la course');
      }
      await fetchCourierData();
      setActiveTab('active');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Courier picks up order at restaurant
  const handlePickup = async (missionId: string) => {
    if (!currentUser) return;
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/missions/${missionId}/pickup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Impossible de confirmer le retrait');
      }
      await fetchCourierData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Courier marks order delivered to client
  const handleDeliver = async (missionId: string) => {
    if (!currentUser) return;
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/missions/${missionId}/deliver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Impossible de confirmer la livraison');
      }
      await fetchCourierData();
      setActiveTab('disponibles');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const isAvailable = Boolean(currentUser?.disponible_livraison);
  const isValidated = currentUser?.statut_validation === 'Accepté';

  return (
    <div className="w-full max-w-[480px] mx-auto min-h-screen bg-[#FFFCF8] flex flex-col pb-24">
      {/* Header */}
      <header className="p-4 bg-white border-b border-[#E8E5DF] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#138A63] text-white flex items-center justify-center font-bold">
              <Bike size={22} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-extrabold text-[#20201E]">
                  Bonjour {currentUser?.prenom || 'Lucas'}
                </h1>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isValidated ? 'bg-[#E7F4EE] text-[#138A63]' : 'bg-amber-100 text-amber-800'
                }`}>
                  {isValidated ? 'Validé' : 'En attente'}
                </span>
              </div>
              <p className="text-xs text-[#6B6B66]">
                {currentUser?.moyen_deplacement || 'Vélo'} · {currentUser?.zone_livraison || 'Paris 11e'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualRefresh}
              className="w-8 h-8 rounded-full border border-[#E8E5DF] flex items-center justify-center text-[#6B6B66] hover:text-[#20201E]"
              title="Rafraîchir"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-[#F26A00]' : ''} />
            </button>
            <button
              type="button"
              onClick={logout}
              className="w-8 h-8 rounded-full border border-[#F8D9BF] bg-[#FFF1E5] flex items-center justify-center text-[#9E3E00] hover:bg-[#FCE3D2]"
              title="Déconnexion"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>

        {/* Availability Toggle */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-[#FFF8EE] border border-[#F8D9BF]">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isAvailable ? 'bg-[#138A63] animate-pulse' : 'bg-gray-400'}`}></span>
            <span className="text-xs font-bold text-[#20201E]">
              {isAvailable ? 'En ligne — Prêt pour livrer' : 'Hors ligne — Indisponible'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleToggleAvailability}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
              isAvailable
                ? 'bg-[#138A63] text-white hover:bg-[#0f6e4f]'
                : 'bg-white border border-[#E8E5DF] text-[#6B6B66] hover:text-[#20201E]'
            }`}
          >
            {isAvailable ? 'Passer hors ligne' : 'Me rendre disponible'}
          </button>
        </div>
      </header>

      {errorMsg && (
        <div className="m-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
          {errorMsg}
        </div>
      )}

      {/* TAB 1: MISSIONS DISPONIBLES */}
      {activeTab === 'disponibles' && (
        <div className="p-4 flex flex-col gap-4">
          {!isAvailable ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-[#E8E5DF] flex flex-col items-center gap-2">
              <Power size={32} className="text-[#6B6B66]" />
              <b className="text-sm text-[#20201E]">Vous êtes actuellement hors ligne</b>
              <p className="text-xs text-[#6B6B66] max-w-xs">
                Activez votre disponibilité en haut de page pour recevoir les propositions de courses en temps réel.
              </p>
              <button
                type="button"
                onClick={handleToggleAvailability}
                className="mt-2 px-4 py-2 bg-[#138A63] text-white rounded-xl text-xs font-bold"
              >
                Passer en ligne
              </button>
            </div>
          ) : availableMissions.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-[#E8E5DF] flex flex-col items-center gap-2">
              <Clock size={32} className="text-[#F26A00]" />
              <b className="text-sm text-[#20201E]">Aucune course en attente</b>
              <p className="text-xs text-[#6B6B66]">
                Dès qu'un restaurateur valide une commande, la mission apparaîtra ici en exclusivité.
              </p>
            </div>
          ) : (
            availableMissions.map((m) => (
              <div
                key={m.id}
                className="p-4 bg-white rounded-2xl border-2 border-[#138A63] flex flex-col gap-3 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-1.5">
                    <Store size={16} className="text-[#F26A00]" />
                    <b className="text-sm font-bold text-[#20201E]">{m.restaurant_nom}</b>
                  </div>
                  <span className="text-base font-extrabold text-[#138A63]">
                    +{m.remuneration_annoncee.toFixed(2)} €
                  </span>
                </div>

                {/* Pickup & Delivery */}
                <div className="flex flex-col gap-2 text-xs bg-[#FFFCF8] p-3 rounded-xl border border-[#E8E5DF]">
                  <div className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#F26A00] mt-1 shrink-0"></span>
                    <div>
                      <span className="text-[#6B6B66]">Retrait : </span>
                      <b className="text-[#20201E]">{m.restaurant_adresse || '10 rue Oberkampf'}</b>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#138A63] mt-1 shrink-0"></span>
                    <div>
                      <span className="text-[#6B6B66]">Livraison : </span>
                      <b className="text-[#20201E]">{m.adresse_livraison || 'Adresse non renseignée'}</b>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleAcceptMission(m.id)}
                  className="w-full py-3 bg-[#138A63] hover:bg-[#0f6e4f] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  Accepter la mission
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: COURSE EN COURS */}
      {activeTab === 'active' && (
        <div className="p-4 flex flex-col gap-4">
          {!activeMission ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-[#E8E5DF] text-xs text-[#6B6B66]">
              Vous n'avez aucune course active pour le moment.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8E5DF] p-5 flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8E5DF]">
                <div>
                  <span className="text-xs font-bold text-[#C94F00]">
                    Commande {activeMission.commande_id} · Mission {activeMission.id}
                  </span>
                  <h2 className="text-base font-extrabold text-[#20201E]">{activeMission.restaurant_nom}</h2>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#FFF1E5] text-[#9E3E00]">
                  {activeMission.statut}
                </span>
              </div>

              {/* Progress status notification */}
              {activeMission.statut === 'Attribuée' && activeMission.statut_commande !== 'Prête' && (
                <div className="p-3 bg-[#FFF8EE] border border-[#F8D9BF] rounded-xl text-xs text-[#9E3E00] flex items-center gap-2">
                  <Clock size={16} className="shrink-0" />
                  <span>
                    Rendez-vous au restaurant pour récupérer la commande dès qu'elle est signalée prête.
                  </span>
                </div>
              )}

              {activeMission.statut === 'Attribuée' && activeMission.statut_commande === 'Prête' && (
                <div className="p-3 bg-[#E7F4EE] border border-[#BCE1D1] rounded-xl text-xs text-[#138A63] flex items-center gap-2">
                  <Bike size={16} className="shrink-0" />
                  <span>
                    La commande est prête : vous pouvez la récupérer au restaurant.
                  </span>
                </div>
              )}

              {activeMission.statut === 'En cours' && (
                <div className="p-3 bg-[#E7F4EE] border border-[#BCE1D1] rounded-xl text-xs text-[#138A63] flex items-center gap-2">
                  <Bike size={16} className="shrink-0" />
                  <span>
                    Commande récupérée ! En route vers le client.
                  </span>
                </div>
              )}

              {/* Step 1: Restaurant Pickup */}
              <div className="p-3.5 bg-[#FFFCF8] border border-[#E8E5DF] rounded-xl flex flex-col gap-1.5 text-xs">
                <span className="font-bold text-[#6B6B66] uppercase text-[10px]">1. Retrait restaurant</span>
                <b className="text-sm text-[#20201E]">{activeMission.restaurant_nom}</b>
                <p className="text-[#6B6B66]">{activeMission.restaurant_adresse || 'Adresse non renseignée'}</p>

                {/* Détail de ce qu'il faut récupérer */}
                {activeMission.lignes && activeMission.lignes.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[#E8E5DF] flex flex-col gap-1">
                    <span className="font-bold text-[#6B6B66] text-[10px] uppercase">À récupérer</span>
                    {activeMission.lignes.map((l) => (
                      <div key={l.id} className="flex justify-between text-[#20201E]">
                        <span>{l.quantite} × {l.nom_plat_enregistre}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Step 2: Client Dropoff */}
              <div className="p-3.5 bg-[#FFFCF8] border border-[#E8E5DF] rounded-xl flex flex-col gap-1.5 text-xs">
                <span className="font-bold text-[#6B6B66] uppercase text-[10px]">2. Livraison client</span>
                <b className="text-sm text-[#20201E]">{activeMission.client_nom || 'Client'}</b>
                <p className="text-[#6B6B66]">{activeMission.adresse_livraison || 'Adresse non renseignée'}</p>
                {activeMission.client_telephone && (
                  <a href={`tel:${activeMission.client_telephone}`} className="text-[#C94F00] font-semibold">
                    📞 {activeMission.client_telephone}
                  </a>
                )}
                {activeMission.instructions_livraison && (
                  <p className="text-[#9E3E00] bg-[#FFF8EE] p-2 rounded-lg mt-1 italic">
                    Note : {activeMission.instructions_livraison}
                  </p>
                )}
              </div>

              {/* Remuneration */}
              <div className="flex justify-between items-center text-xs pt-1">
                <span className="text-[#6B6B66]">Rémunération de la course :</span>
                <b className="text-base font-extrabold text-[#138A63]">
                  {activeMission.remuneration_annoncee.toFixed(2)} €
                </b>
              </div>

              {/* Action CTA */}
              {activeMission.statut === 'Attribuée' ? (
                <button
                  type="button"
                  disabled={activeMission.statut_commande !== 'Prête'}
                  onClick={() => handlePickup(activeMission.id)}
                  className="w-full py-4 bg-[#F26A00] hover:bg-[#C94F00] text-white font-extrabold text-sm rounded-xl shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {activeMission.statut_commande === 'Prête'
                    ? 'Confirmer le retrait au restaurant'
                    : 'En attente de préparation…'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleDeliver(activeMission.id)}
                  className="w-full py-4 bg-[#138A63] hover:bg-[#0f6e4f] text-white font-extrabold text-sm rounded-xl shadow-md transition-colors"
                >
                  Confirmer la livraison au client
                </button>
              )}

              {/* Problem reporting */}
              <button
                type="button"
                onClick={() => setReportModalOrder(activeMission.commande_id)}
                className="w-full py-2 bg-white border border-[#E8E5DF] text-[#6B6B66] hover:text-[#D64545] text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5"
              >
                <MessageSquareWarning size={14} />
                <span>Signaler un problème sur cette course</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: GAINS */}
      {activeTab === 'gains' && (
        <div className="p-4 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-bold text-[#20201E]">Mes revenus de livraison</h2>
            <p className="text-xs text-[#6B6B66]">Calculés en temps réel sur vos missions livrées</p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-[#E8E5DF] flex items-center justify-between">
              <div>
                <span className="text-xs text-[#6B6B66]">Gains aujourd'hui</span>
                <p className="text-2xl font-extrabold text-[#138A63]">
                  {earnings.gainsJour.toFixed(2).replace('.', ',')} €
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#E7F4EE] text-[#138A63] flex items-center justify-center font-bold">
                €
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[#E8E5DF] flex items-center justify-between">
              <div>
                <span className="text-xs text-[#6B6B66]">7 derniers jours</span>
                <p className="text-2xl font-extrabold text-[#20201E]">
                  {earnings.gainsSemaine.toFixed(2).replace('.', ',')} €
                </p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[#E8E5DF] flex items-center justify-between">
              <div>
                <span className="text-xs text-[#6B6B66]">Mois en cours</span>
                <p className="text-2xl font-extrabold text-[#20201E]">
                  {earnings.gainsMois.toFixed(2).replace('.', ',')} €
                </p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[#E8E5DF] flex items-center justify-between">
              <div>
                <span className="text-xs text-[#6B6B66]">Courses terminées</span>
                <p className="text-xl font-bold text-[#20201E]">
                  {earnings.nombreMissionsTerminees}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportModalOrder && (
        <ReportModal
          isOpen={true}
          orderId={reportModalOrder}
          onClose={() => setReportModalOrder(null)}
          onSuccess={() => {
            setReportModalOrder(null);
            fetchCourierData();
          }}
        />
      )}

      {/* Fixed Bottom Navigation (MISSIONS - COURSE ACTIVE - MES GAINS) */}
      <LivreurBottomNav
        activeTab={activeTab === 'active' || activeTab === 'gains' ? activeTab : 'disponibles'}
        onChangeTab={(tab) => setActiveTab(tab)}
        availableMissionsCount={availableMissions.length}
        hasActiveMission={!!activeMission}
      />
    </div>
  );
};
