"use client";

import React, { useState, useEffect } from "react";
import { useUserContext } from "@/context/UserContext";
import { useUser } from "@clerk/nextjs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, CreditCard, PiggyBank, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const paymentOptions = [
  { id: "bank", label: "Bank (UPI)", icon: CreditCard, color: "text-blue-500", bg: "bg-blue-500/10" },
  { id: "cash", label: "Cash", icon: PiggyBank, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { id: "splitwise", label: "Splitwise", icon: ArrowRightLeft, color: "text-orange-500", bg: "bg-orange-500/10" },
];

export default function ProfilePage() {
  const { profile, updateProfile, loading } = useUserContext();
  const { user } = useUser();
  const [name, setName] = useState("");
  const [occupation, setOccupation] = useState("");
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setOccupation(profile.occupation);
      setSelectedMethods(profile.paymentMethods);
    }
  }, [profile]);

  const toggleMethod = (id: string) => {
    setSelectedMethods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    await updateProfile({
      name,
      occupation,
      paymentMethods: selectedMethods,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading || !profile) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground text-lg">Manage your personal information and preferences.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column - User Info & Preview */}
        <Card className="lg:col-span-1 p-8 h-fit flex flex-col items-center text-center gap-6 bg-card/50 backdrop-blur-sm border-primary/10 shadow-xl shadow-primary/5">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-tr from-primary to-primary-foreground rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
            <Avatar className="size-32 border-4 border-background relative">
              <AvatarImage src={user?.imageUrl} />
              <AvatarFallback className="text-4xl font-bold bg-primary/10 text-primary uppercase">
                {profile.name?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">{profile.name}</h2>
            <p className="text-muted-foreground font-medium">{profile.email}</p>
          </div>
          
          <div className="w-full pt-4 border-t border-border/50 grid grid-cols-1 gap-3">
             <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-muted/50">
                <span className="text-sm font-medium text-muted-foreground">Status</span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Active</span>
             </div>
          </div>
        </Card>

        {/* Right Column - Forms */}
        <Card className="lg:col-span-2 p-8 shadow-xl shadow-black/5 bg-card/30 backdrop-blur-sm border-primary/5">
          <div className="space-y-8">
            <div className="space-y-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary" />
                Personal Information
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Full Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 bg-background/50 border-border focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="occupation" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Occupation</Label>
                  <Input
                    id="occupation"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    className="h-12 bg-background/50 border-border focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            <Separator className="opacity-50" />

            <div className="space-y-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary" />
                Active Accounts
              </h3>
              <p className="text-sm text-muted-foreground">Select the payment methods you want to Track on your Dashboard.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {paymentOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => toggleMethod(option.id)}
                    className={cn(
                      "relative flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all duration-300 group ring-offset-background",
                      selectedMethods.includes(option.id)
                        ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                        : "border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40"
                    )}
                  >
                    <div className={cn("p-4 rounded-2xl transition-transform duration-300 group-hover:scale-110", option.bg, option.color)}>
                      <option.icon className="size-7" />
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
            </div>

            <div className="pt-6">
              <Button
                onClick={handleSave}
                disabled={saving}
                size="lg"
                className="w-full sm:w-fit h-14 px-12 rounded-2xl text-base font-bold shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {saving ? "Saving..." : saved ? "Successfully Saved!" : "Save Profile Changes"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
