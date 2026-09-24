import React, { createContext, useContext, useState, useEffect } from 'react';
import { Plat, Restaurant, PanierItem } from '../types.js';

interface CartContextType {
  restaurantId: string | null;
  restaurant: Restaurant | null;
  items: PanierItem[];
  itemCount: number;
  subtotal: number;
  fraisLivraison: number;
  fraisService: number;
  total: number;
  addItem: (plat: Plat, restaurant: Restaurant) => void;
  removeItem: (platId: string) => void;
  updateQuantity: (platId: string, delta: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [items, setItems] = useState<PanierItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Load from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('foodup_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.items && Array.isArray(parsed.items) && parsed.restaurantId) {
          setItems(parsed.items);
          setRestaurantId(parsed.restaurantId);
          setRestaurant(parsed.restaurant || null);
        }
      }
    } catch (e) {
      console.error('Failed to parse cart storage', e);
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    try {
      localStorage.setItem('foodup_cart', JSON.stringify({
        restaurantId,
        restaurant,
        items
      }));
    } catch (e) {
      console.error('Failed to save cart', e);
    }
  }, [items, restaurantId, restaurant]);

  const addItem = (plat: Plat, rest: Restaurant) => {
    // If adding from another restaurant, reset cart with new restaurant
    if (restaurantId && restaurantId !== rest.id) {
      if (window.confirm(`Votre panier contient des articles de "${restaurant?.nom || 'un autre restaurant'}". Voulez-vous le vider pour commander chez "${rest.nom}" ?`)) {
        setRestaurantId(rest.id);
        setRestaurant(rest);
        setItems([{ plat, quantite: 1 }]);
      }
      return;
    }

    setRestaurantId(rest.id);
    setRestaurant(rest);

    setItems(prev => {
      const existing = prev.find(item => item.plat.id === plat.id);
      if (existing) {
        return prev.map(item =>
          item.plat.id === plat.id ? { ...item, quantite: item.quantite + 1 } : item
        );
      }
      return [...prev, { plat, quantite: 1 }];
    });
  };

  const updateQuantity = (platId: string, delta: number) => {
    setItems(prev => {
      const updated = prev
        .map(item => {
          if (item.plat.id === platId) {
            const newQty = item.quantite + delta;
            return newQty > 0 ? { ...item, quantite: newQty } : null;
          }
          return item;
        })
        .filter((item): item is PanierItem => item !== null);

      if (updated.length === 0) {
        setRestaurantId(null);
        setRestaurant(null);
      }
      return updated;
    });
  };

  const removeItem = (platId: string) => {
    setItems(prev => {
      const updated = prev.filter(item => item.plat.id !== platId);
      if (updated.length === 0) {
        setRestaurantId(null);
        setRestaurant(null);
      }
      return updated;
    });
  };

  const clearCart = () => {
    setItems([]);
    setRestaurantId(null);
    setRestaurant(null);
    localStorage.removeItem('foodup_cart');
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantite, 0);
  const subtotal = Number(items.reduce((sum, item) => sum + item.plat.prix * item.quantite, 0).toFixed(2));
  const fraisLivraison = restaurant ? restaurant.frais_livraison : 0;
  const fraisService = restaurant ? restaurant.frais_service : 0;
  const total = Number((subtotal > 0 ? subtotal + fraisLivraison + fraisService : 0).toFixed(2));

  return (
    <CartContext.Provider
      value={{
        restaurantId,
        restaurant,
        items,
        itemCount,
        subtotal,
        fraisLivraison,
        fraisService,
        total,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        isCartOpen,
        setIsCartOpen
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
