"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUserContext } from "@/context/UserContext";

type BalanceAlert = {
  _id: string;
  expectedBalance: number;
  bankBalance: number;
  difference: number;
};

export function BalanceReconciliationPopup() {
  const { refreshProfile } = useUserContext();
  const [alert, setAlert] = useState<BalanceAlert | null>(null);
  const [saving, setSaving] = useState(false);

  const loadAlert = useCallback(async () => {
    const res = await fetch("/api/bank-imports/reconcile");
    if (!res.ok) {
      return;
    }
    const data = await res.json();
    setAlert(data.alerts?.[0] ?? null);
  }, []);

  useEffect(() => {
    loadAlert();
  }, [loadAlert]);

  const resolve = async (action: "apply" | "keep") => {
    if (!alert) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/bank-imports/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alert._id, action }),
      });
      if (res.ok) {
        setAlert(null);
        await refreshProfile();
        await loadAlert();
      }
    } finally {
      setSaving(false);
    }
  };

  if (!alert) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-md">
      <Card className="border-primary/30 p-4 shadow-xl">
        <p className="font-semibold">Bank balance mismatch</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Bank SMS says Bank (UPI) is Rs {alert.bankBalance.toFixed(2)}, but
          Expenser expected Rs {alert.expectedBalance.toFixed(2)}.
        </p>
        <div className="mt-4 flex gap-2">
          <Button disabled={saving} onClick={() => resolve("apply")}>
            Use Bank Balance
          </Button>
          <Button
            disabled={saving}
            variant="outline"
            onClick={() => resolve("keep")}
          >
            Keep App Balance
          </Button>
        </div>
      </Card>
    </div>
  );
}
