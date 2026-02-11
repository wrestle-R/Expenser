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
import { LayoutDashboard, ArrowRightLeft, Wallet, LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useClerk, useUser } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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
    <Sidebar collapsible="icon" className="border-r">
      {/* Header - Left aligned, no subtitle */}
      <SidebarHeader className="border-b px-4 py-4">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground flex-shrink-0">
            <Wallet className="size-4" />
          </div>
          <span className="font-bold text-lg group-data-[collapsible=icon]:hidden">
            Expenser
          </span>
        </div>
      </SidebarHeader>

      {/* Main Navigation */}
      <SidebarContent className="py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2 px-2">
              {navItems.map((item) => {
                const isActive = pathname === item.url || (item.url === "/dashboard" && pathname === "/dashboard");
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <Link href={item.url}>
                      <SidebarMenuButton
                        tooltip={item.title}
                        isActive={isActive}
                        className="w-full"
                      >
                        <Icon className="size-4" />
                        <span>{item.title}</span>
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
      <SidebarFooter className="border-t p-4">
        <SidebarMenu className="gap-2">
          {/* Theme Toggle */}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleTheme}
              tooltip={theme === "light" ? "Dark Mode" : "Light Mode"}
              className="w-full"
            >
              {theme === "light" ? (
                <>
                  <Moon className="size-4" />
                  <span>Dark Mode</span>
                </>
              ) : (
                <>
                  <Sun className="size-4" />
                  <span>Light Mode</span>
                </>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>

          <Separator className="my-1" />

          {/* Profile */}
          <SidebarMenuItem>
            <Link href="/dashboard/profile">
              <SidebarMenuButton
                tooltip="Profile"
                isActive={pathname === "/dashboard/profile"}
                className="w-full"
              >
                <Avatar className="size-5">
                  <AvatarImage src={user?.imageUrl} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">
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
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-4" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
