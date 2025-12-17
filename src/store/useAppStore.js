import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Define Default Presets
export const PALETTE_PRESETS = [
  {
    id: 'default',
    name: 'Default Sky',
    type: 'light',
    colors: {
      light: { bgMain: '#f9fafb', bgSurface: '#ffffff', primary: '#0284c7', primaryText: '#ffffff', textMain: '#111827' },
      dark: { bgMain: '#111827', bgSurface: '#1f2937', primary: '#38bdf8', primaryText: '#0f172a', textMain: '#f9fafb' }
    }
  },
  {
    id: 'blackout',
    name: 'Full Blackout (AMOLED)',
    type: 'dark',
    colors: {
      light: {
        bgMain: '#000000',
        bgSurface: '#0a0a0a',
        primary: '#ffffff',
        primaryText: '#000000',
        textMain: '#ffffff',
        border: '#1a1a1a'
      },
      dark: {
        bgMain: '#000000',
        bgSurface: '#0a0a0a',
        primary: '#ffffff',
        primaryText: '#000000',
        textMain: '#ffffff',
        border: '#1a1a1a'
      }
    }
  },
  {
    id: 'gray',
    name: 'Professional Gray',
    type: 'dark',
    colors: {
      light: { bgMain: '#f3f4f6', bgSurface: '#ffffff', primary: '#4b5563', primaryText: '#ffffff', textMain: '#1f2937' },
      dark: { bgMain: '#18181b', bgSurface: '#27272a', primary: '#a1a1aa', primaryText: '#18181b', textMain: '#f4f4f5', border: '#3f3f46' }
    }
  },
  {
    id: 'midnight',
    name: 'Midnight Blue',
    type: 'dark',
    colors: {
      light: { bgMain: '#eff6ff', bgSurface: '#ffffff', primary: '#1e40af', primaryText: '#ffffff', textMain: '#1e3a8a' },
      dark: { bgMain: '#0f172a', bgSurface: '#1e293b', primary: '#60a5fa', primaryText: '#0f172a', textMain: '#f1f5f9' }
    }
  }
];

const useAppStore = create(
  persist(
    (set, get) => ({
      // --- Master Data ---
      rawTransactions: [],
      rawParticipants: [],

      // --- Derived Data ---
      transactions: [],
      participants: [],
      participantsLookup: new Map(),

      // --- Auxiliary Data ---
      categories: [],
      places: [],
      tags: [],
      modesOfPayment: [],
      templates: [],
      goals: [],
      recurring: [],
      groups: [],

      // --- State & Settings ---
      activeGroupId: 'personal',
      userSettings: {},
      currentUser: null,
      loading: true,
      toast: { show: false, message: '', isError: false },

      // --- PALETTE & THEME STATE (NEW) ---
      activePaletteId: 'default',
      themeMode: 'light', // Global Source of Truth
      customPalettes: [],

      // --- Actions ---
      showToast: (message, isError = false) => {
        set({ toast: { show: true, message, isError } });
        setTimeout(() => {
          set({ toast: { show: false, message: '', isError: false } });
        }, 3000);
      },

      refreshViews: () => {
        const { rawTransactions, rawParticipants, activeGroupId } = get();
        const filteredTxns = rawTransactions.filter(t => (t.groupId || 'personal') === activeGroupId);
        const filteredParts = [...rawParticipants];
        const lookup = new Map();
        lookup.set('me', { name: 'You (me)', uniqueId: 'me' });
        filteredParts.forEach(p => lookup.set(p.uniqueId, p));

        set({ transactions: filteredTxns, participants: filteredParts, participantsLookup: lookup });
      },

      // --- Setters ---
      setActiveGroupId: (id) => { set({ activeGroupId: id }); get().refreshViews(); },
      setGroups: (data) => set({ groups: data }),
      setTransactions: (data) => { set({ rawTransactions: data }); get().refreshViews(); },
      setParticipants: (data) => { set({ rawParticipants: data }); get().refreshViews(); },
      setCategories: (data) => set({ categories: data }),
      setPlaces: (data) => set({ places: data }),
      setTags: (data) => set({ tags: data }),
      setModes: (data) => set({ modesOfPayment: data }),
      setTemplates: (data) => set({ templates: data }),
      setGoals: (data) => set({ goals: data }),
      setRecurring: (data) => set({ recurring: data }),
      setUserSettings: (data) => set({ userSettings: data || {} }),
      setCurrentUser: (user) => set({ currentUser: user }),
      setLoading: (isLoading) => set({ loading: isLoading }),

      // Palette & Theme Setters
      setActivePalette: (id) => set({ activePaletteId: id }),
      setThemeMode: (mode) => set({ themeMode: mode }), // Triggers the update
      addCustomPalette: (palette) => set((state) => ({ customPalettes: [...state.customPalettes, palette] })),
      deleteCustomPalette: (id) => set((state) => ({ customPalettes: state.customPalettes.filter(p => p.id !== id) })),
    }),
    {
      name: 'splittrack-storage',
      partialize: (state) => ({
        activeGroupId: state.activeGroupId,
        userSettings: state.userSettings,
        activePaletteId: state.activePaletteId,
        themeMode: state.themeMode, // Persist Theme
        customPalettes: state.customPalettes
      }),
    }
  )
);

export default useAppStore;