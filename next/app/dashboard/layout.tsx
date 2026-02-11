"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useUserContext } from "@/context/UserContext";
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "../../components/app-sidebar";
import { DashboardTopbar } from "../../components/dashboard-topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSignedIn, isLoaded } = useAuth();
  const { profile, loading } = useUserContext();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      console.log("[DashboardLayout] Not signed in, redirecting to sign-in");
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (isLoaded && isSignedIn && !loading && profile && !profile.onboarded) {
      console.log("[DashboardLayout] User not onboarded, redirecting to onboarding");
      router.push("/onboarding");
    }
  }, [isLoaded, isSignedIn, loading, profile, router]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <DashboardTopbar />
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
