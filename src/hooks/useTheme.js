import { useEffect } from 'react';
import useAppStore, { PALETTE_PRESETS } from '../store/useAppStore';

export const useTheme = () => {
  const { themeMode, setThemeMode, activePaletteId, customPalettes } = useAppStore();

  useEffect(() => {
    const root = window.document.documentElement;

    // 1. Force Apply CSS Class FIRST
    if (themeMode === 'dark') {
      root.classList.add('dark');
      // Also set attribute for extra specificity
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }

    // Set Palette ID for CSS targeting
    root.setAttribute('data-palette', activePaletteId);

    // 2. Apply Palette Colors with higher priority
    const allPalettes = [...PALETTE_PRESETS, ...(customPalettes || [])];
    const activePalette = allPalettes.find(p => p.id === activePaletteId) || PALETTE_PRESETS[0];

    // Get colors for current mode
    const modeColors = activePalette.colors[themeMode] || activePalette.colors.light;

    // 3. Inject CSS Variables with !important flag via style attribute
    if (modeColors) {
      root.style.setProperty('--bg-main', modeColors.bgMain, 'important');
      root.style.setProperty('--bg-surface', modeColors.bgSurface, 'important');
      root.style.setProperty('--primary', modeColors.primary, 'important');
      root.style.setProperty('--primary-text', modeColors.primaryText || '#ffffff', 'important');
      root.style.setProperty('--text-main', modeColors.textMain, 'important');

      if (modeColors.border) {
        root.style.setProperty('--border', modeColors.border, 'important');
      } else {
        root.style.removeProperty('--border');
      }

      // Force body background immediately with !important
      document.body.style.setProperty('background-color', modeColors.bgMain, 'important');
      document.body.style.setProperty('color', modeColors.textMain, 'important');

      // Debug: Log the actual computed style
      const computedBg = window.getComputedStyle(document.body).backgroundColor;
      console.log('DEBUG: Setting bgMain to:', modeColors.bgMain);
      console.log('DEBUG: Computed body background-color:', computedBg);
      console.log('DEBUG: body.style.backgroundColor:', document.body.style.backgroundColor);
    }

    // 4. Log for debugging
    console.log('useTheme useEffect triggered:', {
      activePaletteId,
      themeMode,
      foundPalette: activePalette?.name,
      appliedColors: modeColors
    });

  }, [themeMode, activePaletteId, customPalettes]);

  const toggleTheme = () => {
    const newMode = themeMode === 'dark' ? 'light' : 'dark';
    console.log('Toggling theme from', themeMode, 'to', newMode);
    setThemeMode(newMode);
  };

  const setTheme = (newMode) => {
    console.log('Setting theme to:', newMode);
    setThemeMode(newMode);
  };

  return { theme: themeMode, toggleTheme, setTheme };
};