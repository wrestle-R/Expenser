"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { LayoutDashboard, ArrowRightLeft, Wallet, LogOut, Moon, Sun, Workflow } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useClerk, useUser } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import Link from "next/link";

const navItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Transactions",
    url: "/dashboard/transactions",
    icon: ArrowRightLeft,
  },
  {
    title: "Workflows",
    url: "/dashboard/workflows",
    icon: Workflow,
  },
];

export function AppSidebar() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const handleSignOut = async () => {
    console.log("[AppSidebar] Signing out...");
    localStorage.removeItem("expenser-user-profile");
    await signOut();
    router.push("/");
  };

  return (
    <Sidebar collapsible="icon" className="border-r shadow-sm">
      {/* Header - Left aligned, no subtitle */}
      <SidebarHeader className="px-4 py-6">
        <div className="flex items-center gap-3 transition-all duration-300 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex aspect-square size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 flex-shrink-0">
            <Wallet className="size-5" />
          </div>
          <span className="font-bold text-xl tracking-tight group-data-[collapsible=icon]:hidden">
            Expenser
          </span>
        </div>
      </SidebarHeader>

      {/* Main Navigation */}
      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5 px-3 group-data-[collapsible=icon]:px-2">
              {navItems.map((item) => {
                const isActive = pathname === item.url || (item.url === "/dashboard" && pathname === "/dashboard");
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <Link href={item.url} className="w-full">
                      <SidebarMenuButton
                        tooltip={item.title}
                        isActive={isActive}
                        className={cn(
                          "w-full transition-all duration-300 group-data-[collapsible=icon]:justify-center",
                          isActive 
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-semibold shadow-lg shadow-primary/20 translate-x-1" 
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                        )}
                      >
                        <div className="flex items-center justify-center w-5">
                          <Icon className={cn("size-5 transition-transform duration-300 group-hover/menu-button:scale-110", isActive ? "text-primary-foreground" : "")} />
                        </div>
                        <span className="group-data-[collapsible=icon]:hidden ml-3">{item.title}</span>
                        {isActive && !pathname.includes("profile") && (
                           <div className="absolute left-0 w-1 h-2/3 bg-white rounded-r-full group-data-[collapsible=icon]:hidden" />
                        )}
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t p-3 bg-muted/40">
        <SidebarMenu className="gap-2 px-1">
          {/* Theme Toggle */}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleTheme}
              tooltip={theme === "light" ? "Dark Mode" : "Light Mode"}
              className="w-full group-data-[collapsible=icon]:justify-center transition-all duration-300 hover:bg-accent hover:text-foreground"
            >
              <div className="flex items-center justify-center w-5">
                {theme === "light" ? <Moon className="size-5" /> : <Sun className="size-5" />}
              </div>
              <span className="group-data-[collapsible=icon]:hidden ml-3 font-medium">{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <Separator className="my-1 opacity-50" />

          {/* Profile */}
          <SidebarMenuItem>
            <Link href="/dashboard/profile" className="w-full">
              <SidebarMenuButton
                tooltip="Profile"
                isActive={pathname === "/dashboard/profile"}
                className={cn(
                  "w-full group-data-[collapsible=icon]:justify-center transition-all duration-300",
                  pathname === "/dashboard/profile" 
                    ? "bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20 translate-x-1" 
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <div className="flex items-center justify-center w-5">
                  <Avatar className="size-6 shadow-sm ring-1 ring-border/50">
                    <AvatarImage src={user?.imageUrl} />
                    <AvatarFallback className={cn("text-[10px] font-bold", pathname === "/dashboard/profile" ? "bg-white/20 text-white" : "bg-primary/10 text-primary")}>
                      {user?.firstName?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <span className="truncate group-data-[collapsible=icon]:hidden ml-3">
                  {user?.fullName || user?.firstName || "Profile"}
                </span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>

          {/* Sign Out */}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              tooltip="Sign Out"
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 group-data-[collapsible=icon]:justify-center transition-all duration-300"
            >
              <div className="flex items-center justify-center w-5">
                <LogOut className="size-5" />
              </div>
              <span className="group-data-[collapsible=icon]:hidden ml-3 font-medium">Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
