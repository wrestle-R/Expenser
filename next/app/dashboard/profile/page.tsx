"use client";

import React, { useEffect, useRef, useState } from "react";
import { useUserContext } from "@/context/UserContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Check, CreditCard, PiggyBank, ArrowRightLeft, CirclePlay, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { ProfileSetupPanel } from "@/components/profile-setup-panel";
import { replayDashboardTutorial } from "@/components/dashboard-tutorial";
import { PROFILE_SETUP_HASH } from "@/lib/profile-navigation";
import {
  toggleRequiredPaymentMethod,
  withDefaultPaymentMethod,
} from "@/lib/payment-methods.js";

const paymentOptions = [
  { id: "bank", label: "Bank (UPI)", icon: CreditCard, color: "text-blue-500", bg: "bg-blue-500/10" },
  { id: "cash", label: "Cash", icon: PiggyBank, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { id: "splitwise", label: "Splitwise", icon: ArrowRightLeft, color: "text-orange-500", bg: "bg-orange-500/10" },
];

export default function ProfilePage() {
  const { profile, updateProfile, loading } = useUserContext();
  const setupSectionRef = useRef<HTMLDivElement | null>(null);
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [paymentMethodNotice, setPaymentMethodNotice] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const hydratedProfileRef = useRef(false);

  useEffect(() => {
    if (profile) {
      setTimeout(() => {
        setSelectedMethods(withDefaultPaymentMethod(profile.paymentMethods));
        hydratedProfileRef.current = true;
      }, 0);
    }
  }, [profile]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.location.hash !== `#${PROFILE_SETUP_HASH}`) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setupSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const toggleMethod = (id: string) => {
    const result = toggleRequiredPaymentMethod(selectedMethods, id);
    setPaymentMethodNotice(
      result.blocked ? "At least one payment method must remain enabled." : ""
    );
    setSelectedMethods(result.methods);
  };

  useEffect(() => {
    if (!profile || !hydratedProfileRef.current) {
      return;
    }

    const sameProfile =
      selectedMethods.join("|") === (profile.paymentMethods || []).join("|");

    if (sameProfile) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSaveStatus("saving");
      updateProfile({
        paymentMethods: selectedMethods,
      })
        .then(() => {
          setSaveStatus("saved");
          window.setTimeout(() => setSaveStatus("idle"), 1600);
        })
        .catch((error) => {
          console.error("[Profile] Autosave failed:", error);
          setSaveStatus("error");
        });
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [profile, selectedMethods, updateProfile]);

  if (loading || !profile) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">Account and payment preferences.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.65fr]">
        <Card className="flex h-fit flex-col items-center gap-4 rounded-2xl border-primary/10 bg-card/60 p-5 text-center">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-tr from-primary to-primary-foreground rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
            <Avatar className="relative size-20 border-4 border-background">
              <AvatarFallback className="bg-primary/10 text-primary uppercase">
                <UserRound className="size-9" />
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">{profile.name}</h2>
            <p className="max-w-56 truncate text-sm font-medium text-muted-foreground">{profile.email}</p>
          </div>
          
          <div className="grid w-full grid-cols-1 gap-2 border-t border-border/50 pt-3">
             <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
                <span className="text-sm font-medium text-muted-foreground">Status</span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Active</span>
             </div>
             <Button
               type="button"
               variant="outline"
               data-tutorial-target="tutorial-profile-replay"
               className="h-9 w-full justify-center gap-2 rounded-xl border-primary/15 bg-background/70"
               onClick={replayDashboardTutorial}
             >
               <CirclePlay className="size-4" />
               Replay tutorial
             </Button>
          </div>
        </Card>

        <Card className="rounded-2xl border-primary/5 bg-card/40 p-5">
          <div className="space-y-5">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary" />
                Payment methods
              </h3>
              <p className="text-sm text-muted-foreground">Choose the balances shown across Expenser.</p>
              <div data-tutorial-target="tutorial-profile-accounts" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {paymentOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleMethod(option.id)}
                    className={cn(
                      "group relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors ring-offset-background",
                      selectedMethods.includes(option.id)
                        ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                        : "border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40"
                    )}
                  >
                      <div className={cn("rounded-lg p-2.5", option.bg, option.color)}>
                      <option.icon className="size-5" />
                    </div>
                    <span className="font-bold text-sm tracking-tight">{option.label}</span>
                    {selectedMethods.includes(option.id) && (
                      <div className="absolute top-3 right-3 size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center p-1 shadow-lg animate-in zoom-in duration-300 shadow-primary/20">
                        <Check className="size-4" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <p
                className={cn(
                  "text-sm",
                  paymentMethodNotice
                    ? "font-medium text-destructive"
                    : "text-muted-foreground"
                )}
                role={paymentMethodNotice ? "alert" : undefined}
              >
                {paymentMethodNotice || "Keep at least one payment method enabled."}
              </p>
            </div>

            <p
              className={cn(
                "pt-2 text-sm font-medium",
                saveStatus === "saved" && "text-emerald-600",
                saveStatus === "error" && "text-destructive",
                (saveStatus === "idle" || saveStatus === "saving") &&
                  "text-muted-foreground"
              )}
            >
              {saveStatus === "saving"
                ? "Saving changes..."
                : saveStatus === "saved"
                  ? "Saved"
                  : saveStatus === "error"
                    ? "Autosave failed"
                    : "Changes save automatically"}
            </p>
          </div>
        </Card>
      </div>

      <div className="hidden scroll-mt-24 sm:block">
        <Separator className="opacity-50" />

        <div
          id={PROFILE_SETUP_HASH}
          ref={setupSectionRef}
          className="scroll-mt-24"
        >
          <ProfileSetupPanel />
        </div>
      </div>
    </div>
  );
}
