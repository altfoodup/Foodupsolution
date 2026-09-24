import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useCart } from '../../context/CartContext.js';
import { Restaurant } from '../../types.js';
import { ClientHome } from './ClientHome.js';
import { RestaurantView } from './RestaurantView.js';
import { ClientOrders } from './ClientOrders.js';
import { OrderDetailView } from './OrderDetailView.js';
import { ClientProfile } from './ClientProfile.js';
import { ClientBottomNav } from './ClientBottomNav.js';
import { CartModal } from './CartModal.js';

export const ClientApp: React.FC = () => {
  const { currentUser } = useAuth();
  const { itemCount, isCartOpen, setIsCartOpen, restaurant: cartRestaurant } = useCart();

  const [activeTab, setActiveTab] = useState<'accueil' | 'commandes' | 'profil'>('accueil');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const handleSelectRestaurant = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    setSelectedOrderId(null);
  };

  const handleOpenOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setSelectedRestaurant(null);
    setActiveTab('commandes');
  };

  const handleTabChange = (tab: 'accueil' | 'commandes' | 'profil') => {
    setActiveTab(tab);
    if (tab === 'accueil') {
      setSelectedRestaurant(null);
      setSelectedOrderId(null);
    } else if (tab === 'commandes') {
      setSelectedRestaurant(null);
    } else if (tab === 'profil') {
      setSelectedRestaurant(null);
      setSelectedOrderId(null);
    }
  };

  const handleOrderSuccess = (orderId: string) => {
    setIsCartOpen(false);
    handleOpenOrder(orderId);
  };

  const handleContinueShopping = () => {
    setIsCartOpen(false);
    if (cartRestaurant) {
      setSelectedRestaurant(cartRestaurant);
      setActiveTab('accueil');
    }
  };

  return (
    <div className="w-full max-w-[480px] mx-auto bg-[#FFFCF8] min-h-screen flex flex-col relative shadow-sm">
      {/* Dynamic Sub-Views */}
      {selectedOrderId ? (
        <OrderDetailView
          orderId={selectedOrderId}
          onBack={() => setSelectedOrderId(null)}
        />
      ) : selectedRestaurant ? (
        <RestaurantView
          restaurant={selectedRestaurant}
          onBack={() => setSelectedRestaurant(null)}
          onOpenCart={() => setIsCartOpen(true)}
        />
      ) : activeTab === 'accueil' ? (
        <ClientHome
          userName={currentUser ? `${currentUser.prenom} ${currentUser.nom}` : 'Julie'}
          userAddress={currentUser?.adresse || '12 rue Oberkampf'}
          onSelectRestaurant={handleSelectRestaurant}
          onOpenOrder={handleOpenOrder}
        />
      ) : activeTab === 'commandes' ? (
        <ClientOrders
          onSelectOrder={handleOpenOrder}
        />
      ) : (
        <ClientProfile />
      )}

      {/* Persistent Bottom Nav (always visible unless in cart modal) */}
      {!selectedRestaurant && !selectedOrderId && (
        <ClientBottomNav
          activeTab={activeTab}
          onChangeTab={handleTabChange}
          cartCount={itemCount}
          onOpenCart={() => setIsCartOpen(true)}
        />
      )}

      {/* Cart Modal */}
      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onOrderSuccess={handleOrderSuccess}
        onContinueShopping={handleContinueShopping}
      />
    </div>
  );
};
