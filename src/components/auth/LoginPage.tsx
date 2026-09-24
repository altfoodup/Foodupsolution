import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Mail, Lock, AlertCircle, ArrowRight, UserCheck, ShieldCheck, Store, Bike, Check } from 'lucide-react';

interface Props {
  onOpenRegister?: () => void;
  onSuccess?: () => void;
}

interface TestUser {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  role: string;
  restaurant_nom?: string;
  restaurant_id?: string;
  zone_livraison?: string;
}

export const LoginPage: React.FC<Props> = ({ onOpenRegister, onSuccess }) => {
  const { loginByEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic test accounts from Airtable
  const [testAccounts, setTestAccounts] = useState<TestUser[]>([]);
  const [selectedTestEmail, setSelectedTestEmail] = useState<string>('');
  const [loadingTestAccounts, setLoadingTestAccounts] = useState(false);

  useEffect(() => {
    fetchTestAccounts();
  }, []);

  const fetchTestAccounts = async () => {
    setLoadingTestAccounts(true);
    try {
      const res = await fetch('/api/personas');
      if (res.ok) {
        const users: TestUser[] = await res.json();
        setTestAccounts(users);
        if (users.length > 0 && !selectedTestEmail) {
          // Default selection to Julie Martin if available, else first user
          const julie = users.find(u => u.id === 'USR-001' || u.prenom.toLowerCase() === 'julie');
          setSelectedTestEmail(julie ? julie.email : users[0].email);
        }
      }
    } catch (e) {
      console.error('Error fetching test accounts:', e);
    } finally {
      setLoadingTestAccounts(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Veuillez saisir votre adresse email.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await loginByEmail(email.trim());
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Identifiants incorrects.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickConnect = async (targetEmail: string) => {
    setEmail(targetEmail);
    setError(null);
    setIsSubmitting(true);
    try {
      await loginByEmail(targetEmail);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFCF8] flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-[420px] flex flex-col gap-6">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-[14px] bg-[#F26A00] flex items-center justify-center shadow-xs">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 11h16a8 8 0 0 1-16 0z"/>
              <path d="M9 7c0-1.5 1-2 1-3.5"/>
              <path d="M14 7c0-1.5 1-2 1-3.5"/>
            </svg>
          </div>
          <span className="font-extrabold text-[#F26A00] tracking-wider text-sm uppercase">
            FOODUP
          </span>
          <h1 className="text-2xl font-extrabold text-[#20201E] tracking-tight">
            Ravi de vous revoir
          </h1>
          <p className="text-xs text-[#6B6B66]">
            Connectez-vous à votre espace pour commander ou gérer votre activité
          </p>
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-3.5 bg-[#FDEAEA] border border-[#F5B5B5] text-[#D64545] rounded-xl text-xs font-semibold flex items-center gap-2.5 shadow-2xs">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Main Login Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#E8E5DF] p-6 flex flex-col gap-4 shadow-2xs">
          <div>
            <label className="block text-xs font-bold text-[#20201E] mb-1.5">
              Email
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-[#6B6B66]">
                <Mail size={16} />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ex: julie@foodhop.test"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#FFFCF8] border border-[#E8E5DF] rounded-xl text-xs text-[#20201E] placeholder:text-[#6B6B66]/60 focus:outline-none focus:border-[#F26A00] focus:ring-1 focus:ring-[#F26A00]"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-[#20201E]">
                Mot de passe
              </label>
              <span className="text-[11px] text-[#6B6B66]">
                (Simulé pour recette)
              </span>
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-[#6B6B66]">
                <Lock size={16} />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#FFFCF8] border border-[#E8E5DF] rounded-xl text-xs text-[#20201E] placeholder:text-[#6B6B66]/60 focus:outline-none focus:border-[#F26A00] focus:ring-1 focus:ring-[#F26A00]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 bg-[#F26A00] hover:bg-[#C94F00] active:scale-[0.99] text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Connexion en cours…</span>
            ) : (
              <>
                <span>Se connecter</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>

          {/* Create Account link */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onOpenRegister}
              className="text-xs text-[#6B6B66] hover:text-[#F26A00] font-medium transition-colors"
            >
              Pas encore de compte ? <strong className="text-[#F26A00] font-bold">Créer un compte</strong>
            </button>
          </div>
        </form>

        {/* Development Test Accounts Section (Recette Airtable) */}
        <div className="bg-[#FFF8EE] rounded-2xl border border-[#F8D9BF] p-4.5 flex flex-col gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[#F26A00] text-white">
              Recette
            </span>
            <strong className="text-xs font-bold text-[#20201E]">
              Comptes de test (Airtable)
            </strong>
          </div>

          <p className="text-[11px] text-[#6B6B66] leading-relaxed">
            Choisissez un utilisateur issu directement de la table Airtable <em>Utilisateurs</em> pour tester les rôles, permissions et relations métier.
          </p>

          <div className="flex flex-col gap-2">
            <select
              value={selectedTestEmail}
              onChange={(e) => {
                setSelectedTestEmail(e.target.value);
                setEmail(e.target.value);
              }}
              disabled={loadingTestAccounts || isSubmitting}
              className="w-full px-3 py-2 bg-white border border-[#E8E5DF] rounded-xl text-xs text-[#20201E] focus:outline-none focus:border-[#F26A00]"
            >
              {loadingTestAccounts ? (
                <option>Chargement des comptes Airtable…</option>
              ) : (
                testAccounts.map((u) => {
                  let label = `${u.prenom} ${u.nom} — ${u.role}`;
                  if (u.role === 'Restaurateur' && u.restaurant_nom) {
                    label += ` — ${u.restaurant_nom}`;
                  } else if (u.role === 'Livreur' && u.zone_livraison) {
                    label += ` (${u.zone_livraison})`;
                  }
                  return (
                    <option key={u.id} value={u.email}>
                      {label} ({u.id})
                    </option>
                  );
                })
              )}
            </select>

            <button
              type="button"
              disabled={!selectedTestEmail || isSubmitting}
              onClick={() => handleQuickConnect(selectedTestEmail)}
              className="w-full py-2 bg-[#20201E] hover:bg-[#353532] text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <UserCheck size={14} className="text-[#F26A00]" />
              <span>Se connecter avec ce compte</span>
            </button>
          </div>

          <div className="pt-1 text-[10px] text-[#6B6B66] flex flex-wrap gap-x-3 gap-y-1">
            <span>• <strong>Julie Martin</strong> (Client)</span>
            <span>• <strong>Giulia Rossi</strong> (RST-005 La Petite Trattoria)</span>
            <span>• <strong>Thomas Bernard</strong> (RST-001 Chez Raymonde)</span>
            <span>• <strong>Lucas Petit</strong> (Livreur)</span>
            <span>• <strong>Claire Dubois</strong> (Admin)</span>
          </div>
        </div>

      </div>
    </div>
  );
};
