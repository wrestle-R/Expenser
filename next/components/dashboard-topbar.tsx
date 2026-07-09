"use client";

import { Eye, EyeOff } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useStealthMode } from "@/context/StealthContext";
import { usePathname } from "next/navigation";

const breadcrumbMap: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/transactions": "Transactions",
  "/dashboard/workflows": "Workflows",
  "/dashboard/calendar": "Calendar",
  "/dashboard/analysis": "Analysis",
  "/dashboard/profile": "Profile",
};

export function DashboardTopbar() {
  const pathname = usePathname();
  const currentPage = breadcrumbMap[pathname] || "Dashboard";
  const { isStealthMode, toggleStealthMode } = useStealthMode();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-3 sm:gap-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <SidebarTrigger className="-ml-1" />
        <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
        <Breadcrumb className="min-w-0">
          <BreadcrumbList>
            <BreadcrumbItem className="hidden sm:inline-flex">
              <BreadcrumbLink href="/dashboard">Expenser</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden sm:inline-flex" />
            <BreadcrumbItem>
              <BreadcrumbPage>{currentPage}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={toggleStealthMode}
        data-tutorial-target="tutorial-stealth-toggle"
        aria-label={isStealthMode ? "Show money values" : "Hide money values"}
        title={isStealthMode ? "Show money values" : "Hide money values"}
        className="shrink-0 rounded-2xl border border-transparent bg-background/40 hover:bg-background/70"
      >
        {isStealthMode ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </Button>
    </header>
  );
}
