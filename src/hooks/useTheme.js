import { useEffect } from 'react';
import useAppStore, { PALETTE_PRESETS } from '../store/useAppStore';

export const useTheme = () => {
  // Read directly from Global Store to ensure sync
  const { themeMode, setThemeMode, activePaletteId, customPalettes } = useAppStore();

  useEffect(() => {
    const root = window.document.documentElement;
    
    // 1. Force CSS Class (Global Sync)
    if (themeMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // 2. Apply Palette Colors
    const allPalettes = [...PALETTE_PRESETS, ...(customPalettes || [])];
    const activePalette = allPalettes.find(p => p.id === activePaletteId) || PALETTE_PRESETS[0];
    
    // Get colors for current global mode
    // Fallback: If palette doesn't have a specific mode, use light
    const modeColors = activePalette.colors[themeMode] || activePalette.colors.light;

    // Inject CSS Variables
    if (modeColors) {
        root.style.setProperty('--bg-main', modeColors.bgMain);
        root.style.setProperty('--bg-surface', modeColors.bgSurface);
        root.style.setProperty('--primary', modeColors.primary);
        root.style.setProperty('--text-main', modeColors.textMain);
        if(modeColors.border) root.style.setProperty('--border', modeColors.border);
        else root.style.removeProperty('--border');
    }

  }, [themeMode, activePaletteId, customPalettes]);

  const toggleTheme = () => {
    setThemeMode(themeMode === 'dark' ? 'light' : 'dark');
  };

  const setTheme = (newMode) => {
      setThemeMode(newMode);
  };

  return { theme: themeMode, toggleTheme, setTheme };
};