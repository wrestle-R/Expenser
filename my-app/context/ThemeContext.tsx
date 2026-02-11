import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";
import { getStoredTheme, setStoredTheme } from "@/lib/storage";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useSystemColorScheme();
  const [theme, setThemeState] = useState<Theme>(systemColorScheme ?? "light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    async function loadTheme() {
      const stored = await getStoredTheme();
      if (stored) {
        setThemeState(stored);
      } else if (systemColorScheme) {
        setThemeState(systemColorScheme);
      }
      setMounted(true);
    }
    loadTheme();
  }, [systemColorScheme]);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    await setStoredTheme(newTheme);
    console.log("[ThemeContext] Theme changed to:", newTheme);
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  if (!mounted) {
    return null;
  }

  return (
    <ThemeContext.Provider
      value={{ theme, toggleTheme, setTheme, isDark: theme === "dark" }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
