import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { User, MapPin, Phone, Mail, LogOut, Check } from 'lucide-react';

export const ClientProfile: React.FC = () => {
  const { currentUser, logout, refreshUser } = useAuth();
  const [adresse, setAdresse] = useState(currentUser?.adresse || '');
  const [instructions, setInstructions] = useState(currentUser?.instructions_livraison || '');
  const [telephone, setTelephone] = useState(currentUser?.telephone || '');
  const [savedNotice, setSavedNotice] = useState(false);

  if (!currentUser) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate updating client address
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 px-5 pt-5 pb-28">
      <div>
        <h1 className="text-2xl font-extrabold text-[#20201E]">Votre profil</h1>
        <p className="text-xs text-[#6B6B66]">Gérez vos informations de livraison FoodUp</p>
      </div>

      {savedNotice && (
        <div className="p-3 bg-[#E7F4EE] border border-[#BCE1D1] text-[#138A63] text-xs font-semibold rounded-xl flex items-center gap-2">
          <Check size={16} />
          <span>Informations enregistrées avec succès.</span>
        </div>
      )}

      {/* Account Card */}
      <div className="p-4 bg-white rounded-2xl border border-[#E8E5DF] flex items-center gap-3.5 shadow-2xs">
        <div className="w-12 h-12 rounded-full bg-[#FFF1E5] text-[#C94F00] flex items-center justify-center font-extrabold text-base border border-[#F8D9BF]">
          {currentUser.prenom[0]}{currentUser.nom[0]}
        </div>
        <div className="flex flex-col grow">
          <b className="text-base font-bold text-[#20201E]">
            {currentUser.prenom} {currentUser.nom}
          </b>
          <span className="text-xs text-[#6B6B66]">{currentUser.email}</span>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#FFF1E5] text-[#9E3E00]">
          Client
        </span>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-[#E8E5DF] p-5 flex flex-col gap-4 shadow-2xs">
        <h2 className="text-xs font-bold text-[#20201E] uppercase tracking-wider">
          Adresse de livraison par défaut
        </h2>

        <div>
          <label className="block text-xs font-semibold text-[#20201E] mb-1 flex items-center gap-1.5">
            <MapPin size={14} className="text-[#F26A00]" />
            Adresse
          </label>
          <input
            type="text"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            className="w-full px-3 py-2.5 border border-[#E8E5DF] rounded-xl text-xs bg-[#FFFCF8] text-[#20201E] focus:outline-none focus:border-[#F26A00]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#20201E] mb-1">
            Instructions de livraison pour le coursier
          </label>
          <input
            type="text"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Code porte, étage, bâtiment..."
            className="w-full px-3 py-2.5 border border-[#E8E5DF] rounded-xl text-xs bg-[#FFFCF8] text-[#20201E] focus:outline-none focus:border-[#F26A00]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#20201E] mb-1 flex items-center gap-1.5">
            <Phone size={14} className="text-[#F26A00]" />
            Téléphone
          </label>
          <input
            type="tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            className="w-full px-3 py-2.5 border border-[#E8E5DF] rounded-xl text-xs bg-[#FFFCF8] text-[#20201E] focus:outline-none focus:border-[#F26A00]"
          />
        </div>

        <button
          type="submit"
          className="mt-2 py-2.5 bg-[#F26A00] hover:bg-[#C94F00] text-white font-semibold rounded-xl text-xs transition-colors"
        >
          Enregistrer mes préférences
        </button>
      </form>

      {/* FoodUp values card */}
      <div className="p-4 bg-[#FFF8EE] border border-[#F8D9BF] rounded-2xl flex flex-col gap-1.5 text-xs text-[#9E3E00]">
        <b className="font-bold text-[#C94F00]">L'engagement FoodUp</b>
        <p className="text-[#6B6B66]">
          FoodUp soutient les restaurateurs indépendants et artisans locaux de votre quartier avec des frais transparents et compréhensibles.
        </p>
      </div>

      {/* Logout button */}
      <button
        type="button"
        onClick={logout}
        className="w-full py-3 px-4 bg-white border border-red-200 text-[#D64545] hover:bg-red-50 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-2xs"
      >
        <LogOut size={16} />
        <span>Se déconnecter</span>
      </button>
    </div>
  );
};
