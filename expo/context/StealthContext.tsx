import React, { createContext, useContext, useEffect, useState } from "react";

import { getStoredStealthMode, setStoredStealthMode } from "../lib/storage";

interface StealthContextType {
  isStealthMode: boolean;
  toggleStealthMode: () => void;
  setStealthMode: (enabled: boolean) => void;
}

const StealthContext = createContext<StealthContextType | undefined>(undefined);

export function StealthProvider({ children }: { children: React.ReactNode }) {
  const [isStealthMode, setIsStealthMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    async function loadStealthMode() {
      const stored = await getStoredStealthMode();
      setIsStealthMode(stored);
      setMounted(true);
    }
    loadStealthMode();
  }, []);

  const setStealthMode = (enabled: boolean) => {
    setIsStealthMode(enabled);
    void setStoredStealthMode(enabled);
  };

  const toggleStealthMode = () => {
    setStealthMode(!isStealthMode);
  };

  if (!mounted) {
    return null;
  }

  return (
    <StealthContext.Provider
      value={{ isStealthMode, toggleStealthMode, setStealthMode }}
    >
      {children}
    </StealthContext.Provider>
  );
}

export function useStealthMode() {
  const context = useContext(StealthContext);
  if (!context) {
    throw new Error("useStealthMode must be used within a StealthProvider");
  }
  return context;
}
