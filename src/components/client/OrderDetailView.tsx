import React, { useState, useEffect } from 'react';
import { Commande, Signalement } from '../../types.js';
import { useAuth } from '../../context/AuthContext.js';
import { 
  ArrowLeft, 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Bike, 
  Store, 
  MapPin, 
  MessageSquareWarning, 
  Check, 
  XCircle 
} from 'lucide-react';
import { ReportModal } from './ReportModal.js';

interface Props {
  orderId: string;
  onBack: () => void;
}

export const OrderDetailView: React.FC<Props> = ({ orderId, onBack }) => {
  const { currentUser } = useAuth();
  const [order, setOrder] = useState<Commande | null>(null);
  const [reports, setReports] = useState<Signalement[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchOrder();
    fetchReports();
    // Auto polling every 12 seconds
    const interval = setInterval(() => {
      fetchOrder(false);
      fetchReports();
    }, 12000);
    return () => clearInterval(interval);
  }, [orderId]);

  const fetchOrder = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        headers: currentUser ? { 'x-user-id': currentUser.id } : {}
      });
      if (res.status === 404) {
        setNotFound(true);
        setOrder(null);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setOrder(data);
        setNotFound(false);
      }
    } catch (e) {
      console.error('Error fetching order', e);
    } finally {
      if (showLoading) setLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/reports', {
        headers: currentUser ? { 'x-user-id': currentUser.id } : {}
      });
      if (res.ok) {
        const all: Signalement[] = await res.json();
        const forThisOrder = all.filter(r => r.commande_id === orderId);
        setReports(forThisOrder);
      }
    } catch (e) {
      console.error('Error fetching reports', e);
    }
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchOrder(false);
    fetchReports();
  };

  const handleCancelOrder = async () => {
    if (!window.confirm('Voulez-vous vraiment annuler cette commande ?')) return;
    setCancelLoading(true);
    setCancelMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: currentUser ? { 'x-user-id': currentUser.id } : {}
      });
      if (res.ok) {
        await fetchOrder(false);
        setCancelMessage('Commande annulée avec succès.');
      } else {
        const err = await res.json();
        setCancelMessage(err.error || 'Impossible d’annuler la commande.');
      }
    } catch (e: any) {
      setCancelMessage('Erreur lors de l’annulation.');
    } finally {
      setCancelLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-[#6B6B66]">
        Chargement de la commande {orderId}…
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="p-8 text-center flex flex-col items-center gap-3">
        <AlertCircle size={32} className="text-[#D64545]" />
        <h2 className="text-lg font-bold text-[#20201E]">Commande introuvable</h2>
        <p className="text-xs text-[#6B6B66]">La référence {orderId} n'existe pas ou ne vous appartient pas.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-2 px-4 py-2 bg-[#F26A00] text-white rounded-xl text-xs font-semibold"
        >
          Retour aux commandes
        </button>
      </div>
    );
  }

  // Canonical stages calculation for timeline
  const stages = [
    { key: 'En attente du restaurant', label: 'Commande transmise', desc: 'En attente du restaurant' },
    { key: 'En préparation', label: 'En préparation', desc: order.temps_preparation_min ? `~${order.temps_preparation_min} min` : 'En cuisine' },
    { key: 'Prête', label: 'Prête', desc: 'En attente du coursier' },
    { key: 'En livraison', label: 'En livraison', desc: order.livreur_nom ? `Par ${order.livreur_nom}` : 'En route' },
    { key: 'Livrée', label: 'Livrée', desc: 'Bonne dégustation !' },
  ];

  const getStageIndex = (statut: Commande['statut']) => {
    switch (statut) {
      case 'En attente du restaurant': return 0;
      case 'En préparation': return 1;
      case 'Prête': return 2;
      case 'En livraison': return 3;
      case 'Livrée': return 4;
      default: return -1;
    }
  };

  const currentStageIndex = getStageIndex(order.statut);
  const isCancelledOrRefused = order.statut === 'Refusée' || order.statut === 'Annulée';

  return (
    <div className="flex flex-col gap-5 px-5 pt-4 pb-28">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center border border-[#E8E5DF] bg-white text-[#20201E] hover:bg-[#FFF8EE]"
        >
          <ArrowLeft size={18} strokeWidth={2.2} />
        </button>
        <div className="text-center">
          <span className="text-xs font-extrabold text-[#C94F00]">{order.id}</span>
          <h1 className="text-base font-bold text-[#20201E]">{order.restaurant_nom}</h1>
        </div>
        <button
          type="button"
          onClick={handleManualRefresh}
          className="w-9 h-9 rounded-full flex items-center justify-center border border-[#E8E5DF] bg-white text-[#20201E] hover:bg-[#FFF8EE]"
          title="Rafraîchir"
        >
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-[#F26A00]' : ''} />
        </button>
      </div>

      {cancelMessage && (
        <div className="p-3 bg-[#FFF8EE] border border-[#F8D9BF] rounded-xl text-xs text-[#9E3E00]">
          {cancelMessage}
        </div>
      )}

      {/* Special status banners (Refusée / Annulée) */}
      {order.statut === 'Refusée' && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800">
          <XCircle size={24} className="shrink-0 text-red-600 mt-0.5" />
          <div className="flex flex-col gap-1 text-xs">
            <b className="text-sm font-bold">Commande refusée par le restaurant</b>
            <p>Motif : {order.motif_refus || 'Non précisé'}</p>
            <p className="text-red-700/80">Le paiement simulé a été automatiquement annulé.</p>
          </div>
        </div>
      )}

      {order.statut === 'Annulée' && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex items-start gap-3 text-gray-800">
          <XCircle size={24} className="shrink-0 text-gray-600 mt-0.5" />
          <div className="flex flex-col gap-1 text-xs">
            <b className="text-sm font-bold">Commande annulée</b>
            <p>La commande a été annulée. Aucun débit bancaire.</p>
          </div>
        </div>
      )}

      {/* Canonical timeline for active or delivered orders */}
      {!isCancelledOrRefused && (
        <div className="bg-white rounded-2xl border border-[#E8E5DF] p-5 shadow-2xs">
          <h2 className="text-xs font-bold text-[#6B6B66] uppercase tracking-wider mb-4">
            Suivi de préparation et livraison
          </h2>

          <div className="flex flex-col gap-4 relative">
            {stages.map((stage, idx) => {
              const isPast = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              const isFuture = idx > currentStageIndex;

              return (
                <div key={stage.key} className="flex items-start gap-3.5 relative">
                  {/* Vertical connector line */}
                  {idx < stages.length - 1 && (
                    <div 
                      className={`absolute left-[13px] top-6 bottom-[-16px] w-[2px] ${
                        idx < currentStageIndex ? 'bg-[#138A63]' : 'bg-[#E8E5DF]'
                      }`}
                    />
                  )}

                  {/* Icon circle */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 text-xs font-bold transition-colors ${
                      isPast
                        ? 'bg-[#138A63] text-white'
                        : isCurrent
                        ? 'bg-[#F26A00] text-white ring-4 ring-[#FFF1E5]'
                        : 'bg-[#FFF8EE] border border-[#E8E5DF] text-[#6B6B66]'
                    }`}
                  >
                    {isPast ? <Check size={14} strokeWidth={3} /> : idx + 1}
                  </div>

                  {/* Stage text */}
                  <div className="flex flex-col grow pt-0.5">
                    <span className={`text-sm font-bold ${isCurrent ? 'text-[#C94F00]' : isPast ? 'text-[#138A63]' : 'text-[#6B6B66]'}`}>
                      {stage.label}
                    </span>
                    <span className="text-xs text-[#6B6B66]">
                      {stage.desc}
                    </span>
                  </div>

                  {/* Active pulse */}
                  {isCurrent && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#F26A00] animate-ping shrink-0 mt-2 mr-1" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Assigned courier banner */}
          {order.livreur_nom && (
            <div className="mt-5 pt-4 border-t border-[#E8E5DF] flex items-center gap-3 bg-[#E7F4EE] p-3 rounded-xl">
              <Bike size={20} className="text-[#138A63] shrink-0" />
              <div className="flex flex-col text-xs">
                <b className="text-[#138A63]">Livreur partenaire FoodUp</b>
                <span className="text-[#20201E] font-medium">{order.livreur_nom} prend soin de votre livraison</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action buttons (Cancel before accept, or Report incident) */}
      <div className="flex flex-col gap-2">
        {order.statut === 'En attente du restaurant' && (
          <button
            type="button"
            disabled={cancelLoading}
            onClick={handleCancelOrder}
            className="w-full py-2.5 px-4 bg-white border border-red-300 text-[#D64545] hover:bg-red-50 text-xs font-semibold rounded-xl transition-colors"
          >
            {cancelLoading ? 'Annulation…' : 'Annuler la commande'}
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsReportOpen(true)}
          className="w-full py-2.5 px-4 bg-white border border-[#E8E5DF] hover:border-[#F26A00] text-[#20201E] text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <MessageSquareWarning size={15} className="text-[#F26A00]" />
          <span>Signaler un problème sur cette commande</span>
        </button>
      </div>

      {/* Existing Reports on this order */}
      {reports.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E8E5DF] p-4 flex flex-col gap-3">
          <h3 className="text-xs font-bold text-[#20201E] flex items-center gap-1.5">
            <MessageSquareWarning size={14} className="text-[#F26A00]" />
            Signalement enregistré
          </h3>
          {reports.map(r => (
            <div key={r.id} className="p-3 bg-[#FFF8EE] border border-[#F8D9BF] rounded-xl flex flex-col gap-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-[#9E3E00]">{r.type}</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                  r.statut === 'Résolu' ? 'bg-[#E7F4EE] text-[#138A63]' : 'bg-amber-100 text-amber-800'
                }`}>
                  {r.statut}
                </span>
              </div>
              <p className="text-[#20201E]">{r.description}</p>
              {r.reponse_admin && (
                <div className="pt-2 border-t border-[#F8D9BF] text-[#138A63]">
                  <b>Réponse de FoodUp :</b> {r.reponse_admin}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Snapshot Items and quantities */}
      <div className="bg-white rounded-2xl border border-[#E8E5DF] p-4 flex flex-col gap-3 shadow-2xs">
        <h3 className="text-xs font-bold text-[#20201E]">Détail des plats (enregistré)</h3>
        <div className="flex flex-col gap-2 divide-y divide-[#E8E5DF]">
          {order.lignes && order.lignes.length > 0 ? (
            order.lignes.map(l => (
              <div key={l.id} className="pt-2 first:pt-0 flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#C94F00]">{l.quantite}x</span>
                  <span className="text-[#20201E] font-medium">{l.nom_plat_enregistre}</span>
                </div>
                <span className="font-bold text-[#20201E]">
                  {l.total_ligne.toFixed(2).replace('.', ',')} €
                </span>
              </div>
            ))
          ) : (
            <div className="text-xs text-[#6B6B66]">Détail des plats disponible.</div>
          )}
        </div>

        {/* Pricing Summary */}
        <div className="pt-3 border-t border-[#E8E5DF] flex flex-col gap-1.5 text-xs text-[#6B6B66]">
          <div className="flex justify-between">
            <span>Sous-total</span>
            <span>{order.sous_total.toFixed(2).replace('.', ',')} €</span>
          </div>
          <div className="flex justify-between">
            <span>Frais de livraison</span>
            <span>{order.frais_livraison.toFixed(2).replace('.', ',')} €</span>
          </div>
          <div className="flex justify-between">
            <span>Frais de service</span>
            <span>{order.frais_service.toFixed(2).replace('.', ',')} €</span>
          </div>
          <div className="pt-2 border-t border-[#E8E5DF] flex justify-between text-sm font-extrabold text-[#20201E]">
            <span>Total payé (simulé)</span>
            <span className="text-[#C94F00]">{order.total.toFixed(2).replace('.', ',')} €</span>
          </div>
        </div>
      </div>

      {/* Delivery Address */}
      <div className="bg-white rounded-2xl border border-[#E8E5DF] p-4 flex items-start gap-3 shadow-2xs">
        <MapPin size={18} className="text-[#F26A00] shrink-0 mt-0.5" />
        <div className="flex flex-col text-xs">
          <b className="text-[#20201E] font-bold">Lieu de livraison</b>
          <span className="text-[#6B6B66]">{order.adresse_livraison}</span>
          {order.instructions_livraison && (
            <span className="text-[#6B6B66] italic mt-0.5">
              Instructions : {order.instructions_livraison}
            </span>
          )}
        </div>
      </div>

      {/* Report Modal */}
      <ReportModal
        isOpen={isReportOpen}
        orderId={order.id}
        onClose={() => setIsReportOpen(false)}
        onSuccess={() => {
          setIsReportOpen(false);
          fetchReports();
        }}
      />
    </div>
  );
};
