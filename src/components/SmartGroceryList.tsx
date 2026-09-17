import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';

import { GroceryItem, GroceryCategory, FitnessGoal } from '../types';
import { ShoppingCart, Plus, Trash2, CheckCircle2, Circle, Sparkles, Activity, Filter, CheckCheck } from 'lucide-react';

const CATEGORIES: GroceryCategory[] = [
  'Produce',
  'Protein & Meat',
  'Dairy & Eggs',
  'Pantry & Grains',
  'Snacks & Beverages',
  'Frozen',
  'Other'
];

export const SmartGroceryList: React.FC = () => {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<GroceryItem[]>(() => {
    if (!user) return [];
    try {
      const cached = localStorage.getItem(`customGroceryList_${user.uid}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [error, setError] = useState<string | null>(null);

  // Manual Add State
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<GroceryCategory>('Produce');

  // AI Prompt preferences
  const [aiFocus, setAiFocus] = useState<'clean' | 'budget' | 'high-protein' | 'quick-prep'>('high-protein');

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'users', user.uid, 'groceryList');

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const groceryData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }) as GroceryItem)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setItems(groceryData);
      try {
        localStorage.setItem(`customGroceryList_${user.uid}`, JSON.stringify(groceryData));
      } catch {}
    }, (err) => {
      console.warn('Grocery list listener notice:', err);
    });

    return unsubscribe;
  }, [user]);

  const handleGenerateAiList = async () => {
    if (!user) return;
    setIsGenerating(true);
    setError(null);

    try {
      const preferences = [
        `Focus: ${aiFocus}`,
        `Target Calories: ${profile?.targetCalories || 2000} kcal`,
        `Goal: ${profile?.goal || 'Weight Loss'}`
      ];

      const res = await fetch('/api/ai/smart-grocery-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: profile?.goal || 'Weight Loss',
          preferences
        })
      });

      const resData = await res.json();
      if (!resData.success) throw new Error(resData.error || 'Failed to generate grocery list');

      const generatedItems = resData.data.items || [];
      const newGroceryList: GroceryItem[] = [];

      for (const item of generatedItems) {
        const itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        newGroceryList.push({
          id: itemId,
          userId: user.uid,
          name: item.name,
          category: item.category || 'Pantry & Grains',
          quantity: item.quantity || '1',
          checked: false,
          createdAt: Date.now()
        });
      }

      const merged = [...newGroceryList, ...items];
      setItems(merged);
      try {
        localStorage.setItem(`customGroceryList_${user.uid}`, JSON.stringify(merged));
      } catch {}

      try {
        const batch = writeBatch(db);
        for (const item of newGroceryList) {
          const ref = doc(db, 'users', user.uid, 'groceryList', item.id);
          batch.set(ref, item);
        }
        await batch.commit();
      } catch (firestoreErr) {
        console.warn('Firestore grocery sync notice (saved locally):', firestoreErr);
      }
    } catch (err: any) {
      console.warn('Grocery generation notice:', err);
      setError(err.message || 'Error generating list');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleCheck = async (item: GroceryItem) => {
    if (!user) return;
    const nextChecked = !(item.checked ?? item.completed);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: nextChecked, completed: nextChecked } : i));
    try {
      const updated = items.map(i => i.id === item.id ? { ...i, checked: nextChecked, completed: nextChecked } : i);
      localStorage.setItem(`customGroceryList_${user.uid}`, JSON.stringify(updated));
      await setDoc(doc(db, 'users', user.uid, 'groceryList', item.id), {
        checked: nextChecked,
        completed: nextChecked
      }, { merge: true });
    } catch (err) {
      console.warn('Error toggling grocery item:', err);
    }
  };


  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newItemName.trim()) return;

    try {
      const itemId = `item-${Date.now()}`;
      const groceryItem: GroceryItem = {
        id: itemId,
        userId: user.uid,
        name: newItemName.trim(),
        category: newItemCategory,
        quantity: newItemAmount.trim() || '1 item',
        checked: false,
        createdAt: Date.now()
      };

      await setDoc(doc(db, 'users', user.uid, 'groceryList', itemId), groceryItem);
      setNewItemName('');
      setNewItemAmount('');
    } catch (err: any) {
      console.error(err);
      setError('Failed to add item');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'groceryList', id));
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  const handleClearCompleted = async () => {
    if (!user) return;
    const completedItems = items.filter(i => i.checked);
    if (!completedItems.length) return;

    const batch = writeBatch(db);
    completedItems.forEach(item => {
      const ref = doc(db, 'users', user.uid, 'groceryList', item.id);
      batch.delete(ref);
    });

    try {
      await batch.commit();
    } catch (err) {
      console.error('Error clearing completed items:', err);
    }
  };

  const checkedCount = items.filter(i => i.checked).length;
  const filteredItems = selectedCategoryFilter === 'All'
    ? items
    : items.filter(i => i.category === selectedCategoryFilter);

  return (
    <div className="space-y-6">
      {/* Header Banner with AI List Builder */}
      <div className="bg-gradient-to-br from-emerald-950/50 via-slate-900 to-teal-950/50 border border-emerald-500/20 p-5 rounded-2xl shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/30">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Smart Grocery Planner</h3>
              <p className="text-xs text-slate-400">Nutrient-dense shopping lists aligned with your target macros</p>
            </div>
          </div>
          <span className="text-xs font-bold bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20">
            {checkedCount}/{items.length} Done
          </span>
        </div>

        {/* AI Quick Generator Bar */}
        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase text-slate-400">Focus Mode:</span>
            {(['high-protein', 'clean', 'budget', 'quick-prep'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setAiFocus(mode)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition capitalize ${
                  aiFocus === mode
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {mode.replace('-', ' ')}
              </button>
            ))}
          </div>

          <button
            onClick={handleGenerateAiList}
            disabled={isGenerating}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm"
          >
            {isGenerating ? (
              <>
                <Activity className="w-3.5 h-3.5 animate-spin" />
                <span>Curating Whole Foods...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Clean Market List</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs font-bold">
          {error}
        </div>
      )}

      {/* Manual Quick Add Form */}
      <form onSubmit={handleManualAdd} className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-md flex flex-wrap sm:flex-nowrap gap-2 items-center">
        <input
          type="text"
          placeholder="Add an item (e.g. Organic Eggs, Spinach)"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
        />
        <input
          type="text"
          placeholder="Qty (e.g. 1 dozen)"
          value={newItemAmount}
          onChange={(e) => setNewItemAmount(e.target.value)}
          className="w-28 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
        />
        <select
          value={newItemCategory}
          onChange={(e) => setNewItemCategory(e.target.value as GroceryCategory)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!newItemName.trim()}
          className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1 transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add</span>
        </button>
      </form>

      {/* Aisle Category Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setSelectedCategoryFilter('All')}
          className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
            selectedCategoryFilter === 'All'
              ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
              : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          All Items ({items.length})
        </button>
        {CATEGORIES.map((cat) => {
          const count = items.filter(i => i.category === cat).length;
          if (count === 0 && selectedCategoryFilter !== cat) return null;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
                selectedCategoryFilter === cat
                  ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Grocery Items List */}
      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 border-dashed p-8 rounded-2xl text-center">
            <ShoppingCart className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-400">Your grocery list is empty</p>
            <p className="text-xs text-slate-500 mt-0.5">Click "Generate Clean Market List" or type items above.</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className={`p-3.5 rounded-2xl border transition flex items-center justify-between ${
                item.checked
                  ? 'bg-slate-950/50 border-slate-900 opacity-60'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => handleToggleCheck(item)}
                  className="text-slate-500 hover:text-emerald-400 transition shrink-0"
                >
                  {item.checked ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-400/20" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-600" />
                  )}
                </button>
                <div className="truncate">
                  <span className={`text-xs font-bold block truncate ${
                    item.checked ? 'line-through text-slate-500' : 'text-white'
                  }`}>
                    {item.name}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-400 font-medium">{item.quantity}</span>
                    <span className="text-[10px] bg-slate-950 text-slate-500 px-1.5 py-0.2 rounded border border-slate-800">
                      {item.category}
                    </span>
                    {item.notes && (
                      <span className="text-[10px] text-emerald-400/80 truncate">{item.notes}</span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDeleteItem(item.id)}
                className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition shrink-0 ml-2"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer Actions */}
      {checkedCount > 0 && (
        <div className="flex justify-end pt-2">
          <button
            onClick={handleClearCompleted}
            className="text-xs font-bold text-slate-400 hover:text-red-400 transition flex items-center gap-1.5"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Clear {checkedCount} Completed Items</span>
          </button>
        </div>
      )}
    </div>
  );
};
