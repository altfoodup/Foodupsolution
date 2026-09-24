import React, { createContext, useContext, useState, useEffect } from 'react';
import { Utilisateur, Restaurant } from '../types.js';

interface AuthContextType {
  currentUser: Utilisateur | null;
  currentRestaurant: Restaurant | null;
  isLoading: boolean;
  isLoginPage: boolean;
  setIsLoginPage: (show: boolean) => void;
  loginByEmail: (email: string) => Promise<void>;
  switchPersona: (email: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setCurrentRestaurant: (r: Restaurant | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Utilisateur | null>(null);
  const [currentRestaurant, setCurrentRestaurant] = useState<Restaurant | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoginPage, setIsLoginPage] = useState<boolean>(false);

  // Initialize with stored user or default to Julie Martin (Client USR-001 in Airtable)
  useEffect(() => {
    // Check if URL specifies /connexion
    if (window.location.pathname === '/connexion' || window.location.hash === '#/connexion') {
      setIsLoginPage(true);
    }

    const savedEmail = localStorage.getItem('foodup_active_email') || 'julie@foodhop.test';
    loginByEmail(savedEmail)
      .catch(() => {
        // If login fails, stay on login page
        setIsLoginPage(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const loginByEmail = async (email: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de la connexion.');
      }
      const data = await res.json();
      setCurrentUser(data.user);
      setCurrentRestaurant(data.restaurant || null);
      localStorage.setItem('foodup_active_email', data.user.email);
      setIsLoginPage(false);
    } catch (err) {
      console.error('Login error:', err);
      throw err;
    }
  };

  const switchPersona = async (email: string) => {
    setIsLoading(true);
    try {
      await loginByEmail(email);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setCurrentRestaurant(null);
    localStorage.removeItem('foodup_active_email');
    localStorage.removeItem('foodup_cart');
    setIsLoginPage(true);
  };

  const refreshUser = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email })
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        if (data.restaurant) {
          setCurrentRestaurant(data.restaurant);
        }
      }
    } catch (err) {
      console.error('Refresh user error:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentRestaurant,
        isLoading,
        isLoginPage,
        setIsLoginPage,
        loginByEmail,
        switchPersona,
        logout,
        refreshUser,
        setCurrentRestaurant
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
