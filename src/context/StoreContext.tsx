import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, setDoc, deleteDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../AuthContext';
import { UserProfile, FoodItem, DailyStats, MealType } from '../types';
import { initialMockProfile, initialMockFoodItems, initialMockDailyStats, getTodayDateString } from '../mockData';
import { sanitizeForFirestore } from '../lib/firestoreSanitizer';

export type ScreenType = 'profile' | 'main-log' | 'daily-log' | 'diet-plan' | 'hydration' | 'history' | 'recipes' | 'grocery';

interface StoreContextType {
  userProfile: UserProfile;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  foodItems: FoodItem[];
  addFoodItem: (item: Omit<FoodItem, 'id' | 'createdAt'>) => Promise<FoodItem>;
  updateFoodItem: (id: string, updates: Partial<FoodItem>) => Promise<void>;
  removeFoodItem: (id: string) => Promise<void>;
  dailyStats: DailyStats;
  incrementWater: () => void;
  decrementWater: () => void;
  resetWater: () => void;
  activeScreen: ScreenType;
  setActiveScreen: (screen: ScreenType) => void;
  unimplementedFeature: string | null;
  setUnimplementedFeature: (name: string | null) => void;
  isSyncing: boolean;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile>(initialMockProfile);
  const [foodItems, setFoodItems] = useState<FoodItem[]>(initialMockFoodItems);
  const [dailyStats, setDailyStats] = useState<DailyStats>(initialMockDailyStats);
  const [activeScreen, setActiveScreen] = useState<ScreenType>('daily-log');
  const [unimplementedFeature, setUnimplementedFeature] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Hydrate from Firestore upon user login
  useEffect(() => {
    if (!user || !user.uid) return;

    const syncRemoteData = async () => {
      setIsSyncing(true);
      try {
        const logsRef = collection(db, 'users', user.uid, 'foodLogs');
        const q = query(logsRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const remoteItems = snapshot.docs.map((d) => d.data() as FoodItem);
          setFoodItems(remoteItems);
        } else {
          // Initialize mock seeds in local view if user has no entries yet
          setFoodItems(initialMockFoodItems);
        }
      } catch (err) {
        console.warn('Firestore foodLogs read notice (using local cache):', err);
      } finally {
        setIsSyncing(false);
      }
    };

    syncRemoteData();
  }, [user?.uid]);

  const updateUserProfile = (updates: Partial<UserProfile>) => {
    setUserProfile((prev) => {
      const next = { ...prev, ...updates, updatedAt: Date.now() };
      
      // Dual-write: localStorage
      try {
        localStorage.setItem(`userProfile_${user?.uid || 'default'}`, JSON.stringify(next));
      } catch {}

      // Dual-write: Firestore
      if (user && user.uid) {
        setDoc(doc(db, 'users', user.uid), sanitizeForFirestore(next), { merge: true }).catch((e) =>
          console.warn('Firestore profile sync notice:', e)
        );
      }

      return next;
    });
  };

  const addFoodItem = async (newItemData: Omit<FoodItem, 'id' | 'createdAt'>): Promise<FoodItem> => {
    const id = `food-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const createdItem: FoodItem = {
      ...newItemData,
      id,
      userId: user?.uid || newItemData.userId || 'default-user',
      createdAt: Date.now(),
      date: newItemData.date || getTodayDateString()
    };

    // 1. Update in-memory state
    setFoodItems((prev) => [createdItem, ...prev]);

    // 2. Dual-Write: localStorage cache
    try {
      const cacheKey = `foodItems_${user?.uid || 'default'}`;
      const existingRaw = localStorage.getItem(cacheKey);
      const list = existingRaw ? JSON.parse(existingRaw) : [];
      localStorage.setItem(cacheKey, JSON.stringify([createdItem, ...list]));
    } catch (e) {
      console.warn('localStorage cache notice:', e);
    }

    // 3. Dual-Write: Firestore under enforced auth
    if (user && user.uid) {
      try {
        const docRef = doc(db, 'users', user.uid, 'foodLogs', id);
        await setDoc(docRef, sanitizeForFirestore(createdItem));
      } catch (err) {
        console.warn('Firestore foodLogs write notice:', err);
      }
    }

    return createdItem;
  };

  const updateFoodItem = async (id: string, updates: Partial<FoodItem>) => {
    setFoodItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );

    // Dual-write: localStorage
    try {
      const cacheKey = `foodItems_${user?.uid || 'default'}`;
      const existingRaw = localStorage.getItem(cacheKey);
      if (existingRaw) {
        const list = (JSON.parse(existingRaw) as FoodItem[]).map((item) =>
          item.id === id ? { ...item, ...updates } : item
        );
        localStorage.setItem(cacheKey, JSON.stringify(list));
      }
    } catch {}

    // Dual-write: Firestore
    if (user && user.uid) {
      try {
        const docRef = doc(db, 'users', user.uid, 'foodLogs', id);
        await setDoc(docRef, sanitizeForFirestore(updates), { merge: true });
      } catch (err) {
        console.warn('Firestore foodLogs update notice:', err);
      }
    }
  };

  const removeFoodItem = async (id: string) => {
    setFoodItems((prev) => prev.filter((item) => item.id !== id));

    // Dual-write: Firestore removal
    if (user && user.uid) {
      try {
        const docRef = doc(db, 'users', user.uid, 'foodLogs', id);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn('Firestore foodLogs delete notice:', err);
      }
    }

    // Dual-write: localStorage
    try {
      const cacheKey = `foodItems_${user?.uid || 'default'}`;
      const existingRaw = localStorage.getItem(cacheKey);
      if (existingRaw) {
        const list = (JSON.parse(existingRaw) as FoodItem[]).filter((item) => item.id !== id);
        localStorage.setItem(cacheKey, JSON.stringify(list));
      }
    } catch {}
  };

  const incrementWater = () => {
    setDailyStats((prev) => {
      const next = { ...prev, waterGlasses: prev.waterGlasses + 1, updatedAt: Date.now() };
      if (user && user.uid) {
        setDoc(doc(db, 'users', user.uid, 'dailyStats', getTodayDateString()), sanitizeForFirestore(next), { merge: true }).catch(() => {});
      }
      return next;
    });
  };

  const decrementWater = () => {
    setDailyStats((prev) => {
      const next = { ...prev, waterGlasses: Math.max(0, prev.waterGlasses - 1), updatedAt: Date.now() };
      if (user && user.uid) {
        setDoc(doc(db, 'users', user.uid, 'dailyStats', getTodayDateString()), sanitizeForFirestore(next), { merge: true }).catch(() => {});
      }
      return next;
    });
  };

  const resetWater = () => {
    setDailyStats((prev) => {
      const next = { ...prev, waterGlasses: 0, updatedAt: Date.now() };
      if (user && user.uid) {
        setDoc(doc(db, 'users', user.uid, 'dailyStats', getTodayDateString()), sanitizeForFirestore(next), { merge: true }).catch(() => {});
      }
      return next;
    });
  };

  return (
    <StoreContext.Provider
      value={{
        userProfile,
        updateUserProfile,
        foodItems,
        addFoodItem,
        updateFoodItem,
        removeFoodItem,
        dailyStats,
        incrementWater,
        decrementWater,
        resetWater,
        activeScreen,
        setActiveScreen,
        unimplementedFeature,
        setUnimplementedFeature,
        isSyncing
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return ctx;
}
