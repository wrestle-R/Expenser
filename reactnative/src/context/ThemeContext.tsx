import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import {useColorScheme, StatusBar} from 'react-native';
import {Colors, ThemeColors} from '../ui/theme/colors';
import {getStoredTheme, setStoredTheme} from '../data/local/storage';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  toggleTheme: () => {},
  colors: Colors.light,
});

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemScheme === 'dark');

  useEffect(() => {
    getStoredTheme().then((stored: 'light' | 'dark' | null) => {
      if (stored) {
        setIsDark(stored === 'dark');
      }
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const newDark = !prev;
      setStoredTheme(newDark ? 'dark' : 'light');
      return newDark;
    });
  }, []);

  const colors = useMemo(
    () => (isDark ? Colors.dark : Colors.light),
    [isDark],
  );

  return (
    <ThemeContext.Provider value={{isDark, toggleTheme, colors}}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
