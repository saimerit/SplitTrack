import { create } from 'zustand';

const useAppStore = create((set, get) => ({
  // --- Master Data (Raw Sync from Firestore) ---
  rawTransactions: [],
  rawParticipants: [],
  
  // --- Derived Data (Visible to UI) ---
  transactions: [],
  participants: [],
  
  // --- Auxiliary Data ---
  categories: [],
  places: [],
  tags: [],
  modesOfPayment: [],
  templates: [],
  goals: [],
  groups: [], 

  // --- State & Settings ---
  activeGroupId: localStorage.getItem('activeGroupId') || 'personal', 
  userSettings: {},
  currentUser: null,
  loading: true,
  toast: { show: false, message: '', isError: false },

  // --- Actions ---

  showToast: (message, isError = false) => {
    set({ toast: { show: true, message, isError } });
    setTimeout(() => {
      set({ toast: { show: false, message: '', isError: false } });
    }, 3000);
  },

  // Lookup Maps
  participantsLookup: new Map(),

  // Helper to re-filter data when Group or Raw Data changes
  refreshViews: () => {
    const { rawTransactions, rawParticipants, activeGroupId } = get();
    
    // Filter Transactions (Still scoped to Active Group)
    // Backwards compatibility: If txn.groupId is missing, assume 'personal'
    const filteredTxns = rawTransactions.filter(t => 
      (t.groupId || 'personal') === activeGroupId
    );

    // --- CHANGE: Participants are now GLOBAL (No filtering) ---
    const filteredParts = [...rawParticipants];

    // Update Lookup
    const lookup = new Map();
    lookup.set('me', { name: 'You (me)', uniqueId: 'me' });
    filteredParts.forEach(p => lookup.set(p.uniqueId, p));

    set({ 
      transactions: filteredTxns, 
      participants: filteredParts, 
      participantsLookup: lookup 
    });
  },

  // --- Setters ---

  setActiveGroupId: (id) => {
    localStorage.setItem('activeGroupId', id);
    set({ activeGroupId: id });
    get().refreshViews();
  },

  setGroups: (data) => set({ groups: data }),

  setTransactions: (data) => {
    set({ rawTransactions: data });
    get().refreshViews();
  },
  
  setParticipants: (data) => {
    set({ rawParticipants: data });
    get().refreshViews();
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