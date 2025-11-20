import { create } from 'zustand';

// Removed 'get' from the parameter list
const useAppStore = create((set) => ({
  // Data Arrays
  transactions: [],
  participants: [],
  categories: [],
  places: [],
  tags: [],
  modesOfPayment: [],
  templates: [],
  goals: [],
  
  // Settings & User State
  userSettings: {},
  currentUser: null,
  loading: true,
  // ... existing state
  toast: { show: false, message: '', isError: false },
  
  showToast: (message, isError = false) => {
    set({ toast: { show: true, message, isError } });
    setTimeout(() => {
      set({ toast: { show: false, message: '', isError: false } });
    }, 3000);
  },

  // Lookup Maps
  participantsLookup: new Map(),

  // Actions
  setTransactions: (data) => set({ transactions: data }),
  
  setParticipants: (data) => {
    const lookup = new Map();
    lookup.set('me', { name: 'You (me)', uniqueId: 'me' });
    data.forEach(p => lookup.set(p.uniqueId, p));
    set({ participants: data, participantsLookup: lookup });
  },

  setCategories: (data) => set({ categories: data }),
  setPlaces: (data) => set({ places: data }),
  setTags: (data) => set({ tags: data }),
  setModes: (data) => set({ modesOfPayment: data }),
  setTemplates: (data) => set({ templates: data }),
  setGoals: (data) => set({ goals: data }),
  setUserSettings: (data) => set({ userSettings: data || {} }),
  setCurrentUser: (user) => set({ currentUser: user }),
  setLoading: (isLoading) => set({ loading: isLoading }),
}));

export default useAppStore;