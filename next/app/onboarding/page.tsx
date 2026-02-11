"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { useUserContext } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Wallet,
  CreditCard,
  PiggyBank,
  ArrowRightLeft,
  Check,
  IndianRupee,
} from "lucide-react";

const paymentOptions = [
  {
    id: "bank",
    label: "Bank (UPI)",
    description: "Track your bank and UPI transactions",
    icon: CreditCard,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    id: "cash",
    label: "Cash",
    description: "Track your cash spending",
    icon: PiggyBank,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    id: "splitwise",
    label: "Splitwise",
    description: "Track money owed via Splitwise",
    icon: ArrowRightLeft,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const { profile, updateProfile } = useUserContext();

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [occupation, setOccupation] = useState("");
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [balances, setBalances] = useState({ bank: 0, cash: 0, splitwise: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (profile?.onboarded) {
      console.log("[Onboarding] User already onboarded, redirecting to dashboard");
      router.push("/dashboard");
    }
  }, [profile, router]);

  useEffect(() => {
    if (user) {
      setName(user.fullName || "");
      console.log("[Onboarding] Pre-filled name:", user.fullName);
    }
  }, [user]);

  const toggleMethod = (id: string) => {
    setSelectedMethods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleComplete = async () => {
    setSaving(true);
    console.log("[Onboarding] Completing onboarding with:", { name, occupation, selectedMethods, balances });

    const filteredBalances = {
      bank: selectedMethods.includes("bank") ? balances.bank : 0,
      cash: selectedMethods.includes("cash") ? balances.cash : 0,
      splitwise: selectedMethods.includes("splitwise") ? balances.splitwise : 0,
    };

    await updateProfile({
      name,
      occupation,
      paymentMethods: selectedMethods,
      balances: filteredBalances,
      onboarded: true,
    });

    console.log("[Onboarding] Onboarding complete, navigating to dashboard");
    setSaving(false);
    router.push("/dashboard");
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Step {step} of 3
            </span>
            <Wallet className="size-5 text-primary" />
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <Card className="p-6 space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Welcome to Expenser!</h2>
              <p className="text-muted-foreground mt-1">
                Let&apos;s set up your profile to get started.
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="occupation">
                  Occupation{" "}
                  <span className="text-muted-foreground">(e.g., Student, Developer)</span>
                </Label>
                <Input
                  id="occupation"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  placeholder="What do you do?"
                />
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => setStep(2)}
              disabled={!name.trim()}
            >
              Continue
            </Button>
          </Card>
        )}

        {/* Step 2: Payment Methods */}
        {step === 2 && (
          <Card className="p-6 space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Which do you use?</h2>
              <p className="text-muted-foreground mt-1">
                Select the payment methods you want to track.
              </p>
            </div>
            <div className="space-y-3">
              {paymentOptions.map((option) => {
                const isSelected = selectedMethods.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleMethod(option.id)}
                    className={`w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-border/80"
                    }`}
                  >
                    <div className={`rounded-lg p-2.5 ${option.bg}`}>
                      <option.icon className={`size-5 ${option.color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {option.description}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="rounded-full bg-primary p-1">
                        <Check className="size-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={selectedMethods.length === 0}
                className="flex-1"
              >
                Continue
              </Button>
            </div>
          </Card>
        )}

        {/* Step 3: Enter Balances */}
        {step === 3 && (
          <Card className="p-6 space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Current Balances</h2>
              <p className="text-muted-foreground mt-1">
                Enter your current balance for each method.
              </p>
            </div>
            <div className="space-y-4">
              {selectedMethods.map((method) => {
                const option = paymentOptions.find((o) => o.id === method)!;
                return (
                  <div key={method} className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <option.icon className={`size-4 ${option.color}`} />
                      {option.label} Balance
                    </Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        type="number"
                        placeholder="0"
                        className="pl-9"
                        value={balances[method as keyof typeof balances] || ""}
                        onChange={(e) =>
                          setBalances((prev) => ({
                            ...prev,
                            [method]: Number(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleComplete}
                disabled={saving}
                className="flex-1"
              >
                {saving ? "Setting up..." : "Complete Setup"}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
