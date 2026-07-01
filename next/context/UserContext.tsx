"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { type Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  occupation: string;
  paymentMethods: string[]; // ["bank", "cash", "splitwise"]
  balances: {
    bank: number;
    cash: number;
    splitwise: number;
  };
  onboarded: boolean;
  dashboardTutorialCompleted: boolean;
  workflows?: {
    _id: string;
    name: string;
    type: "income" | "expense";
    amount: number;
    description: string;
    category: string;
    paymentMethod: "bank" | "cash" | "splitwise";
    splitAmount: number;
  }[];
}

interface UserContextType {
  profile: UserProfile | null;
  loading: boolean;
  authLoaded: boolean;
  isSignedIn: boolean;
  session: Session | null;
  error: string | null;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isSignedIn = Boolean(session?.user);

  const readErrorMessage = useCallback(async (res: Response) => {
    const fallback = `Request failed with status ${res.status}`;

    try {
      const data = await res.json();
      return data?.error || fallback;
    } catch {
      return fallback;
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!authLoaded) {
      return;
    }

    if (!isSignedIn) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        localStorage.setItem("expenser-user-profile", JSON.stringify(data.profile));
      } else if (res.status === 404) {
        setProfile(null);
      } else {
        throw new Error(await readErrorMessage(res));
      }
    } catch (err) {
      console.error("[UserContext] Error fetching profile:", err);
      // Try to load from localStorage as fallback
      const cached = localStorage.getItem("expenser-user-profile");
      if (cached) {
        try {
          setProfile(JSON.parse(cached));
        } catch {
          setError("Failed to load profile");
        }
      }
    } finally {
      setLoading(false);
    }
  }, [authLoaded, isSignedIn, readErrorMessage]);

  const updateProfile = async (data: Partial<UserProfile>) => {
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const result = await res.json();
        setProfile(result.profile);
        localStorage.setItem("expenser-user-profile", JSON.stringify(result.profile));
      } else {
        throw new Error(await readErrorMessage(res));
      }
    } catch (err) {
      console.error("[UserContext] Error updating profile:", err);
      setError("Failed to update profile");
    }
  };

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }
      setSession(data.session);
      setAuthLoaded(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoaded(true);
      if (!nextSession) {
        localStorage.removeItem("expenser-user-profile");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return (
    <UserContext.Provider
      value={{
        profile,
        loading,
        authLoaded,
        isSignedIn,
        session,
        error,
        refreshProfile: fetchProfile,
        updateProfile,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (!context) {
    // Return safe defaults during SSR/prerendering
    return {
      profile: null,
      loading: true,
      authLoaded: false,
      isSignedIn: false,
      session: null,
      error: null,
      refreshProfile: async () => {},
      updateProfile: async () => {},
    } as UserContextType;
  }
  return context;
}
