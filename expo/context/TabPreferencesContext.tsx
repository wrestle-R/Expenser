import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import {
  getStoredBottomTabSlots,
  setStoredBottomTabSlots,
} from "../lib/storage";
import type { BottomTabSlot } from "../lib/types";

interface TabPreferencesContextType {
  slots: BottomTabSlot[];
  updateSlots: (slots: BottomTabSlot[]) => Promise<void>;
}

const DEFAULT_SLOTS: BottomTabSlot[] = ["transactions", "analysis", "empty"];
const TabPreferencesContext = createContext<TabPreferencesContextType | undefined>(
  undefined
);

export function TabPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [slots, setSlots] = useState<BottomTabSlot[]>(DEFAULT_SLOTS);

  useEffect(() => {
    let mounted = true;

    getStoredBottomTabSlots()
      .then((storedSlots) => {
        if (mounted) {
          setSlots(storedSlots);
        }
      })
      .catch((error) => {
        console.error("[TabPreferences] Failed to load slots:", error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const updateSlots = useCallback(async (nextSlots: BottomTabSlot[]) => {
    const normalized = nextSlots.slice(0, 3);
    while (normalized.length < 3) {
      normalized.push("empty");
    }

    setSlots(normalized);
    await setStoredBottomTabSlots(normalized);
  }, []);

  return (
    <TabPreferencesContext.Provider value={{ slots, updateSlots }}>
      {children}
    </TabPreferencesContext.Provider>
  );
}

export function useTabPreferences() {
  const context = useContext(TabPreferencesContext);
  if (!context) {
    return {
      slots: DEFAULT_SLOTS,
      updateSlots: async () => {},
    } satisfies TabPreferencesContextType;
  }

  return context;
}
