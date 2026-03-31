"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface StealthContextType {
  isStealthMode: boolean;
  toggleStealthMode: () => void;
  setStealthMode: (enabled: boolean) => void;
}

const STEALTH_STORAGE_KEY = "expenser-stealth-mode";

const StealthContext = createContext<StealthContextType | undefined>(undefined);

export function StealthProvider({ children }: { children: React.ReactNode }) {
  const [isStealthMode, setIsStealthMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STEALTH_STORAGE_KEY);
    if (stored != null) {
      setTimeout(() => {
        setIsStealthMode(stored === "true");
      }, 0);
    }
  }, []);

  const setStealthMode = (enabled: boolean) => {
    setIsStealthMode(enabled);
    localStorage.setItem(STEALTH_STORAGE_KEY, String(enabled));
  };

  const toggleStealthMode = () => {
    setStealthMode(!isStealthMode);
  };

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
    return {
      isStealthMode: false,
      toggleStealthMode: () => {},
      setStealthMode: () => {},
    };
  }
  return context;
}
