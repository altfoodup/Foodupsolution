import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Role } from '../../types.js';
import { X, User, Store, Bike } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const RegisterModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { switchPersona } = useAuth();
  const [role, setRole] = useState<Role>('Client');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [adresse, setAdresse] = useState('');
  const [codePostal, setCodePostal] = useState('75011');
  const [ville, setVille] = useState('Paris');
  const [instructions, setInstructions] = useState('');

  // Courier
  const [moyenDeplacement, setMoyenDeplacement] = useState('Vélo électrique');
  const [zoneLivraison, setZoneLivraison] = useState('Paris 11e / Oberkampf');

  // Restaurant
  const [nomRestaurant, setNomRestaurant] = useState('');
  const [cuisine, setCuisine] = useState('Italien');
  const [descriptionResto, setDescriptionResto] = useState('');
  const [quartier, setQuartier] = useState('Oberkampf');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          prenom,
          nom,
          email,
          telephone,
          adresse,
          code_postal: codePostal,
          ville,
          instructions_livraison: instructions,
          moyen_deplacement: moyenDeplacement,
          zone_livraison: zoneLivraison,
          nom_restaurant: nomRestaurant,
          cuisine,
          description_restaurant: descriptionResto,
          quartier,
          delai: '20–30 min',
          frais_livraison: 2.50
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de l’inscription');
      }

      const data = await res.json();
      await switchPersona(data.user.email);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[#FFFCF8] w-full max-w-lg rounded-2xl border border-[#E8E5DF] p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#E8E5DF]">
          <div>
            <h2 className="text-xl font-bold text-[#20201E]">Créer un compte FoodUp</h2>
            <p className="text-sm text-[#6B6B66]">Rejoignez le réseau local de restauration indépendante.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center border border-[#E8E5DF] text-[#6B6B66] hover:text-[#20201E] hover:bg-[#FFF1E5]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Role Choice */}
        <div className="grid grid-cols-3 gap-2 my-5">
          <button
            type="button"
            onClick={() => setRole('Client')}
            className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold ${
              role === 'Client'
                ? 'border-[#F26A00] bg-[#FFF1E5] text-[#9E3E00]'
                : 'border-[#E8E5DF] bg-white text-[#6B6B66] hover:border-[#F26A00]'
            }`}
          >
            <User size={20} className={role === 'Client' ? 'text-[#F26A00]' : 'text-[#6B6B66]'} />
            Commander
          </button>
          <button
            type="button"
            onClick={() => setRole('Restaurateur')}
            className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold ${
              role === 'Restaurateur'
                ? 'border-[#F26A00] bg-[#FFF1E5] text-[#9E3E00]'
                : 'border-[#E8E5DF] bg-white text-[#6B6B66] hover:border-[#F26A00]'
            }`}
          >
            <Store size={20} className={role === 'Restaurateur' ? 'text-[#F26A00]' : 'text-[#6B6B66]'} />
            Restaurateur
          </button>
          <button
            type="button"
            onClick={() => setRole('Livreur')}
            className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold ${
              role === 'Livreur'
                ? 'border-[#F26A00] bg-[#FFF1E5] text-[#9E3E00]'
                : 'border-[#E8E5DF] bg-white text-[#6B6B66] hover:border-[#F26A00]'
            }`}
          >
            <Bike size={20} className={role === 'Livreur' ? 'text-[#F26A00]' : 'text-[#6B6B66]'} />
            Livreur
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#20201E] mb-1">Prénom</label>
              <input
                type="text"
                required
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                placeholder="Ex. Alexandre"
                className="w-full px-3 py-2 border border-[#E8E5DF] rounded-xl text-sm focus:outline-none focus:border-[#F26A00] bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#20201E] mb-1">Nom</label>
              <input
                type="text"
                required
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex. Lefèvre"
                className="w-full px-3 py-2 border border-[#E8E5DF] rounded-xl text-sm focus:outline-none focus:border-[#F26A00] bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#20201E] mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alexandre@example.com"
                className="w-full px-3 py-2 border border-[#E8E5DF] rounded-xl text-sm focus:outline-none focus:border-[#F26A00] bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#20201E] mb-1">Téléphone</label>
              <input
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="06 12 34 56 78"
                className="w-full px-3 py-2 border border-[#E8E5DF] rounded-xl text-sm focus:outline-none focus:border-[#F26A00] bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#20201E] mb-1">Adresse</label>
            <input
              type="text"
              required
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder="14 rue de la Roquette"
              className="w-full px-3 py-2 border border-[#E8E5DF] rounded-xl text-sm focus:outline-none focus:border-[#F26A00] bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#20201E] mb-1">Code Postal</label>
              <input
                type="text"
                value={codePostal}
                onChange={(e) => setCodePostal(e.target.value)}
                className="w-full px-3 py-2 border border-[#E8E5DF] rounded-xl text-sm focus:outline-none focus:border-[#F26A00] bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#20201E] mb-1">Ville</label>
              <input
                type="text"
                value={ville}
                onChange={(e) => setVille(e.target.value)}
                className="w-full px-3 py-2 border border-[#E8E5DF] rounded-xl text-sm focus:outline-none focus:border-[#F26A00] bg-white"
              />
            </div>
          </div>

          {/* Role specific inputs */}
          {role === 'Client' && (
            <div>
              <label className="block text-xs font-semibold text-[#20201E] mb-1">Instructions de livraison (facultatif)</label>
              <input
                type="text"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Code porte, étage, interphone..."
                className="w-full px-3 py-2 border border-[#E8E5DF] rounded-xl text-sm focus:outline-none focus:border-[#F26A00] bg-white"
              />
            </div>
          )}

          {role === 'Restaurateur' && (
            <div className="p-3.5 bg-[#FFF8EE] border border-[#F8D9BF] rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-[#9E3E00]">Informations du restaurant</h4>
              <div>
                <label className="block text-xs font-semibold text-[#20201E] mb-1">Nom de l’établissement</label>
                <input
                  type="text"
                  required
                  value={nomRestaurant}
                  onChange={(e) => setNomRestaurant(e.target.value)}
                  placeholder="Ex. Pizzeria Bella Vita"
                  className="w-full px-3 py-2 border border-[#E8E5DF] rounded-xl text-sm focus:outline-none focus:border-[#F26A00] bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#20201E] mb-1">Type de cuisine</label>
                  <select
                    value={cuisine}
                    onChange={(e) => setCuisine(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E8E5DF] rounded-xl text-sm focus:outline-none focus:border-[#F26A00] bg-white"
                  >
                    <option value="Italien">Italien</option>
                    <option value="Français">Français</option>
                    <option value="Libanais">Libanais</option>
                    <option value="Asiatique">Asiatique</option>
                    <option value="Burgers">Burgers</option>
                    <option value="Healthy">Healthy</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#20201E] mb-1">Quartier</label>
                  <input
                    type="text"
                    value={quartier}
                    onChange={(e) => setQuartier(e.target.value)}
                    placeholder="Bastille / Oberkampf"
                    className="w-full px-3 py-2 border border-[#E8E5DF] rounded-xl text-sm focus:outline-none focus:border-[#F26A00] bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#20201E] mb-1">Courte description</label>
                <textarea
                  rows={2}
                  value={descriptionResto}
                  onChange={(e) => setDescriptionResto(e.target.value)}
                  placeholder="Spécialités de pâtes fraîches et pizzas au feu de bois..."
                  className="w-full px-3 py-2 border border-[#E8E5DF] rounded-xl text-sm focus:outline-none focus:border-[#F26A00] bg-white"
                />
              </div>
              <p className="text-[11px] text-[#6B6B66]">
                ℹ️ Votre établissement sera soumis à validation par l’administrateur FoodUp avant ouverture aux commandes.
              </p>
            </div>
          )}

          {role === 'Livreur' && (
            <div className="p-3.5 bg-[#E7F4EE] border border-[#BCE1D1] rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-[#138A63]">Informations livreur partenaire</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#20201E] mb-1">Moyen de transport</label>
                  <select
                    value={moyenDeplacement}
                    onChange={(e) => setMoyenDeplacement(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E8E5DF] rounded-xl text-sm focus:outline-none focus:border-[#F26A00] bg-white"
                  >
                    <option value="Vélo musculaire">Vélo musculaire</option>
                    <option value="Vélo électrique">Vélo électrique</option>
                    <option value="Vélo cargo">Vélo cargo</option>
                    <option value="Scooter électrique">Scooter électrique</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#20201E] mb-1">Zone de livraison</label>
                  <input
                    type="text"
                    value={zoneLivraison}
                    onChange={(e) => setZoneLivraison(e.target.value)}
                    placeholder="Paris 11e / 10e"
                    className="w-full px-3 py-2 border border-[#E8E5DF] rounded-xl text-sm focus:outline-none focus:border-[#F26A00] bg-white"
                  />
                </div>
              </div>
              <p className="text-[11px] text-[#6B6B66]">
                ℹ️ Votre candidature sera examinée par l’équipe FoodUp avant l’accès aux missions.
              </p>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#F26A00] hover:bg-[#C94F00] text-white font-semibold rounded-xl transition-colors disabled:opacity-50 text-sm"
            >
              {loading ? 'Création en cours…' : 'Créer mon compte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
