import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ThemeMode, ThemeColors, themes, lightTheme } from './themes';
import { getSetting, setSetting } from '../database/settingsRepository';

interface ThemeContextType {
  themeMode: ThemeMode;
  theme: ThemeColors;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  cycleTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'light',
  theme: lightTheme,
  setThemeMode: async () => {},
  cycleTheme: async () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    (async () => {
      try {
        const saved = await getSetting('app_theme', 'light');
        if (saved && saved in themes) {
          setThemeModeState(saved as ThemeMode);
        }
      } catch (e) {
        console.warn('Erro ao carregar tema persistido:', e);
      }
    })();
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    if (themes[mode]) {
      setThemeModeState(mode);
      try {
        await setSetting('app_theme', mode);
      } catch (e) {
        console.warn('Erro ao salvar tema:', e);
      }
    }
  }, []);

  const cycleTheme = useCallback(async () => {
    const freeThemes: ThemeMode[] = ['light', 'dark_blue'];
    const currentIndex = freeThemes.indexOf(themeMode);
    const next: ThemeMode =
      currentIndex !== -1 ? freeThemes[(currentIndex + 1) % freeThemes.length] : 'light';
    await setThemeMode(next);
  }, [themeMode, setThemeMode]);

  const value = {
    themeMode,
    theme: themes[themeMode] || lightTheme,
    setThemeMode,
    cycleTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}
