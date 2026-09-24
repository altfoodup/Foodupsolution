import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { CartProvider } from './context/CartContext.js';
import { RegisterModal } from './components/auth/RegisterModal.js';
import { LoginPage } from './components/auth/LoginPage.js';
import { ClientApp } from './components/client/ClientApp.js';
import { RestaurateurApp } from './components/restaurateur/RestaurateurApp.js';
import { LivreurApp } from './components/livreur/LivreurApp.js';
import { AdminApp } from './components/admin/AdminApp.js';

function MainLayout() {
  const { currentUser, isLoading, isLoginPage, setIsLoginPage } = useAuth();
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFFCF8] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-[14px] bg-[#F26A00] flex items-center justify-center animate-pulse shadow-xs">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 11h16a8 8 0 0 1-16 0z"/>
              <path d="M9 7c0-1.5 1-2 1-3.5"/>
              <path d="M14 7c0-1.5 1-2 1-3.5"/>
            </svg>
          </div>
          <span className="text-xs font-bold text-[#6B6B66]">Chargement de FoodUp…</span>
        </div>
      </div>
    );
  }

  // If on login page or no user logged in, display the dedicated LoginPage
  if (isLoginPage || !currentUser) {
    return (
      <>
        <LoginPage 
          onOpenRegister={() => setIsRegisterOpen(true)} 
          onSuccess={() => setIsLoginPage(false)}
        />
        <RegisterModal
          isOpen={isRegisterOpen}
          onClose={() => setIsRegisterOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF8EE]/30 flex flex-col font-sans text-[#20201E] antialiased">
      {/* Main role-based workspace - begins directly with the FoodUp workspace (NO top persona switcher) */}
      <main className="grow flex flex-col">
        {currentUser.role === 'Client' ? (
          <ClientApp />
        ) : currentUser.role === 'Restaurateur' ? (
          <RestaurateurApp />
        ) : currentUser.role === 'Livreur' ? (
          <LivreurApp />
        ) : currentUser.role === 'Administrateur' ? (
          <AdminApp />
        ) : (
          <ClientApp />
        )}
      </main>

      {/* Register Modal */}
      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
      />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <MainLayout />
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
