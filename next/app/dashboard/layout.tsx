"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserContext } from "@/context/UserContext";
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "../../components/app-sidebar";
import { BalanceReconciliationPopup } from "../../components/balance-reconciliation-popup";
import { DashboardTopbar } from "../../components/dashboard-topbar";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, loading, authLoaded, isSignedIn } = useUserContext();
  const router = useRouter();

  useEffect(() => {
    if (authLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [authLoaded, isSignedIn, router]);

  useEffect(() => {
    if (authLoaded && isSignedIn && !loading && profile && !profile.onboarded) {
      router.push("/onboarding");
    }
  }, [authLoaded, isSignedIn, loading, profile, router]);

  if (!authLoaded || !isSignedIn) {
    return (
      <div className="flex h-screen bg-background">
        <div className="hidden w-64 border-r p-4 md:block">
          <Skeleton className="mb-8 h-10 w-36" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="mb-6 h-12 w-full" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-xl" />
            ))}
          </div>
        </div>
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
        <BalanceReconciliationPopup />
      </SidebarInset>
    </SidebarProvider>
  );
}
