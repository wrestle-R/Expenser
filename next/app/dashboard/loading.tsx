import { Wallet } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="flex aspect-square size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground animate-pulse">
            <Wallet className="size-6" />
          </div>
          <div className="absolute inset-0 rounded-xl bg-primary opacity-20 animate-ping" />
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">Loading dashboard...</p>
      </div>
    </div>
  );
}
