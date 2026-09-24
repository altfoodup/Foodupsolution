import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { X, MessageSquareWarning } from 'lucide-react';

interface Props {
  isOpen: boolean;
  orderId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReportModal: React.FC<Props> = ({
  isOpen,
  orderId,
  onClose,
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const [type, setType] = useState<string>('Retard');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Veuillez décrire le problème rencontré.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || ''
        },
        body: JSON.stringify({
          commande_id: orderId,
          type,
          description: description.trim()
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de l’envoi du signalement.');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[#FFFCF8] w-full max-w-md rounded-2xl border border-[#E8E5DF] p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-[#E8E5DF]">
          <div className="flex items-center gap-2">
            <MessageSquareWarning size={18} className="text-[#F26A00]" />
            <h3 className="text-base font-bold text-[#20201E]">Signaler un problème</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center border border-[#E8E5DF] text-[#6B6B66] hover:text-[#20201E]"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <p className="text-xs text-[#6B6B66]">
            Commande concernée : <strong className="text-[#20201E]">{orderId}</strong>
          </p>

          {error && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#20201E] mb-1">
              Type d'incident
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border border-[#E8E5DF] rounded-xl text-xs bg-white text-[#20201E] focus:outline-none focus:border-[#F26A00]"
            >
              <option value="Retard">Retard de livraison</option>
              <option value="Commande incorrecte">Plat manquant ou commande incorrecte</option>
              <option value="Problème de livraison">Problème de livraison / coursier</option>
              <option value="Annulation">Demande d'annulation</option>
              <option value="Client absent">Client absent</option>
              <option value="Autre">Autre problème</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#20201E] mb-1">
              Description détaillée
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Expliquez-nous précisément ce qui s’est passé…"
              className="w-full p-3 border border-[#E8E5DF] rounded-xl text-xs bg-white text-[#20201E] focus:outline-none focus:border-[#F26A00]"
            />
          </div>

          <div className="p-3 bg-[#FFF8EE] border border-[#F8D9BF] rounded-xl text-[11px] text-[#9E3E00]">
            Votre signalement sera transmis à l'équipe FoodUp et suivi depuis votre commande.
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="grow py-2.5 bg-white border border-[#E8E5DF] text-[#20201E] text-xs font-semibold rounded-xl hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="grow py-2.5 bg-[#F26A00] hover:bg-[#C94F00] text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? 'Envoi…' : 'Envoyer le signalement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
