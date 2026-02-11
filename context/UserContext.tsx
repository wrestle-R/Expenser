"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useUser, useAuth } from "@clerk/nextjs";

export interface UserProfile {
  clerkId: string;
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
  error: string | null;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded: isClerkLoaded } = useUser();
  const { isSignedIn, getToken } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!isSignedIn || !user) {
      setProfile(null);
      setLoading(false);
      console.log("[UserContext] No signed in user, clearing profile");
      return;
    }

    try {
      setLoading(true);
      console.log("[UserContext] Fetching profile for user:", user.id);

      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        localStorage.setItem("expenser-user-profile", JSON.stringify(data.profile));
        console.log("[UserContext] Profile loaded:", data.profile);
      } else if (res.status === 404) {
        console.log("[UserContext] No profile found, user needs onboarding");
        setProfile(null);
      } else {
        throw new Error("Failed to fetch profile");
      }
    } catch (err) {
      console.error("[UserContext] Error fetching profile:", err);
      // Try to load from localStorage as fallback
      const cached = localStorage.getItem("expenser-user-profile");
      if (cached) {
        try {
          setProfile(JSON.parse(cached));
          console.log("[UserContext] Loaded profile from cache");
        } catch {
          setError("Failed to load profile");
        }
      }
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, user]);

  const updateProfile = async (data: Partial<UserProfile>) => {
    try {
      console.log("[UserContext] Updating profile:", data);
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const result = await res.json();
        setProfile(result.profile);
        localStorage.setItem("expenser-user-profile", JSON.stringify(result.profile));
        console.log("[UserContext] Profile updated:", result.profile);
      } else {
        throw new Error("Failed to update profile");
      }
    } catch (err) {
      console.error("[UserContext] Error updating profile:", err);
      setError("Failed to update profile");
    }
  };

  useEffect(() => {
    if (isClerkLoaded) {
      fetchProfile();
    }
  }, [isClerkLoaded, fetchProfile]);

  // Log auth state changes
  useEffect(() => {
    console.log("[UserContext] Auth state changed - isSignedIn:", isSignedIn, "isClerkLoaded:", isClerkLoaded);
    if (isSignedIn && user) {
      console.log("[UserContext] Clerk user:", { id: user.id, email: user.primaryEmailAddress?.emailAddress });
    }
  }, [isSignedIn, isClerkLoaded, user]);

  return (
    <UserContext.Provider
      value={{
        profile,
        loading,
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
      error: null,
      refreshProfile: async () => {},
      updateProfile: async () => {},
    } as UserContextType;
  }
  return context;
}
