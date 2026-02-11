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
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Avatar className="size-16">
            <AvatarImage src={user?.imageUrl} />
            <AvatarFallback className="text-xl">
              {profile.name?.[0] || "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-lg">{profile.name}</p>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="occupation">Occupation</Label>
            <Input
              id="occupation"
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Methods</Label>
            <div className="space-y-2">
              {paymentOptions.map((option) => {
                const isSelected = selectedMethods.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleMethod(option.id)}
                    className={`w-full flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-border/80"
                    }`}
                  >
                    <div className={`rounded-md p-1.5 ${option.bg}`}>
                      <option.icon className={`size-4 ${option.color}`} />
                    </div>
                    <span className="font-medium text-sm flex-1">{option.label}</span>
                    {isSelected && (
                      <div className="rounded-full bg-primary p-0.5">
                        <Check className="size-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
