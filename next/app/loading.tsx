import { Wallet } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="flex aspect-square size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground animate-pulse">
            <Wallet className="size-8" />
          </div>
          <div className="absolute inset-0 rounded-2xl bg-primary opacity-20 animate-ping" />
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
      </div>
    </div>
  );
}
