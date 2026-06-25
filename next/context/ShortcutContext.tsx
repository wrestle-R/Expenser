"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import { useStealthMode } from "@/context/StealthContext";

export type ShortcutAction =
  | "dashboard"
  | "transactions"
  | "workflows"
  | "calendar"
  | "analysis"
  | "setup"
  | "toggleStealth"
  | "toggleTheme";

export type ShortcutMap = Record<ShortcutAction, string>;

const SHORTCUT_STORAGE_KEY = "expenser-shortcuts";

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  dashboard: "1",
  transactions: "2",
  workflows: "3",
  calendar: "4",
  analysis: "5",
  setup: "s",
  toggleStealth: "x",
  toggleTheme: "d",
};

const ROUTES: Partial<Record<ShortcutAction, string>> = {
  dashboard: "/dashboard",
  transactions: "/dashboard/transactions",
  workflows: "/dashboard/workflows",
  calendar: "/dashboard/calendar",
  analysis: "/dashboard/analysis",
  setup: "/dashboard/setup",
};

type ShortcutContextType = {
  shortcuts: ShortcutMap;
  setShortcut: (action: ShortcutAction, key: string) => void;
  resetShortcuts: () => void;
};

const ShortcutContext = createContext<ShortcutContextType | undefined>(undefined);

function normalizeShortcutKey(key: string) {
  return key.trim().toLowerCase().slice(0, 1);
}

export function ShortcutProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { toggleTheme } = useTheme();
  const { toggleStealthMode } = useStealthMode();
  const [shortcuts, setShortcuts] = useState<ShortcutMap>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_SHORTCUTS;
    }

    const stored = window.localStorage.getItem(SHORTCUT_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SHORTCUTS;
    }

    try {
      return { ...DEFAULT_SHORTCUTS, ...JSON.parse(stored) };
    } catch {
      return DEFAULT_SHORTCUTS;
    }
  });

  const actionsByKey = useMemo(() => {
    return Object.entries(shortcuts).reduce<Record<string, ShortcutAction>>(
      (acc, [action, key]) => {
        const normalized = normalizeShortcutKey(key);
        if (normalized) {
          acc[normalized] = action as ShortcutAction;
        }
        return acc;
      },
      {}
    );
  }, [shortcuts]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if (isTypingTarget || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const action = actionsByKey[event.key.toLowerCase()];
      if (!action) {
        return;
      }

      event.preventDefault();
      if (action === "toggleTheme") {
        toggleTheme();
        return;
      }
      if (action === "toggleStealth") {
        toggleStealthMode();
        return;
      }

      const route = ROUTES[action];
      if (route) {
        router.push(route);
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [actionsByKey, router, toggleStealthMode, toggleTheme]);

  const value = useMemo<ShortcutContextType>(
    () => ({
      shortcuts,
      setShortcut: (action, key) => {
        const normalized = normalizeShortcutKey(key);
        const next = { ...shortcuts, [action]: normalized };
        setShortcuts(next);
        localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(next));
      },
      resetShortcuts: () => {
        setShortcuts(DEFAULT_SHORTCUTS);
        localStorage.setItem(
          SHORTCUT_STORAGE_KEY,
          JSON.stringify(DEFAULT_SHORTCUTS)
        );
      },
    }),
    [shortcuts]
  );

  return (
    <ShortcutContext.Provider value={value}>
      {children}
    </ShortcutContext.Provider>
  );
}

export function useShortcuts() {
  const context = useContext(ShortcutContext);
  if (!context) {
    return {
      shortcuts: DEFAULT_SHORTCUTS,
      setShortcut: () => {},
      resetShortcuts: () => {},
    } as ShortcutContextType;
  }
  return context;
}
