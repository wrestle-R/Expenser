"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowRightLeft,
  Check,
  CreditCard,
  PiggyBank,
  Wallet,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useUserContext } from "@/context/UserContext";
import { cn } from "@/lib/utils";
import { HeroHeader } from "./header";

const features = [
  "Track income & expenses",
  "Organize by category",
  "Keep tabs on Splitwise",
  "See your spending patterns",
  "Import bank notifications",
  "Record transactions offline",
];

const accounts = [
  { icon: CreditCard, label: "Bank", amount: "15,000" },
  { icon: PiggyBank, label: "Cash", amount: "5,500" },
  { icon: ArrowRightLeft, label: "Splitwise", amount: "4,000" },
];

export default function HeroSection() {
  const { isSignedIn } = useUserContext();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <HeroHeader />
      <main className="flex flex-1 items-center justify-center px-5 pb-5 pt-20 sm:px-8 sm:pb-12 sm:pt-24 lg:pt-28">
        <section aria-labelledby="hero-heading" className="mx-auto w-full max-w-6xl">
          <div className="grid items-center gap-6 sm:gap-8 md:grid-cols-[1fr_0.95fr] md:gap-10 lg:gap-16">
            <div className="flex max-w-xl flex-col gap-4 sm:gap-6 lg:gap-7">
              <div className="flex items-center gap-2.5 text-sm font-medium text-muted-foreground">
                <Wallet aria-hidden="true" className="size-4" />
                <span>Personal finance, made simple</span>
              </div>

              <div className="flex flex-col gap-4 sm:gap-5">
                <h1
                  id="hero-heading"
                  className="text-balance text-[2.25rem] font-bold leading-[1.06] tracking-[-0.045em] sm:text-5xl lg:text-[4.25rem]"
                >
                  Track Every <span className="italic text-primary">Rupee</span>, Effortlessly.
                </h1>
                <p className="max-w-md text-pretty text-sm leading-relaxed sm:text-base text-muted-foreground lg:text-lg">
                  Your bank, cash, and Splitwise balances in one place.
                  Know where your money goes, and what&apos;s left.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href={isSignedIn ? "/dashboard" : "/sign-up"}
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "h-11 gap-3 rounded-full px-6 motion-safe:hover:-translate-y-0.5",
                  )}
                >
                  {isSignedIn ? "Go to Dashboard" : "Get Started Free"}
                  <ArrowRight data-icon="inline-end" aria-hidden="true" />
                </Link>
                {!isSignedIn && (
                  <Link
                    href="/sign-in"
                    className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-11 rounded-full px-6")}
                  >
                    Sign In
                  </Link>
                )}
              </div>

              <p className="hidden text-xs leading-relaxed sm:block text-muted-foreground sm:text-sm">
                Less guesswork. A little more peace of mind.
              </p>
            </div>

            <Card variant="outline" className="rounded-xl shadow-lg shadow-foreground/5">
              <CardHeader className="gap-2 p-5 pb-4 sm:p-7 sm:pb-5">
                <CardDescription>Your everyday money, together</CardDescription>
                <CardTitle>
                  <h2 className="text-lg leading-snug tracking-tight sm:text-2xl">One place. A clearer picture.</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 sm:px-7 sm:pb-6">
                <ul className="grid grid-cols-2 gap-x-4 gap-y-3 sm:gap-x-5 sm:gap-y-4">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Separator className="my-4 sm:my-6" />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">Total balance</p>
                  <p className="font-mono text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">₹24,500</p>
                </div>
              </CardContent>
              <CardFooter className="flex-col items-stretch gap-4 sm:gap-5 px-5 pb-4 sm:px-7 sm:pb-6">
                <div className="grid grid-cols-3 gap-3">
                  {accounts.map((account) => (
                    <div key={account.label} className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <account.icon aria-hidden="true" className="size-4 shrink-0" />
                        <span className="text-xs sm:text-sm">{account.label}</span>
                      </div>
                      <p className="font-mono text-sm font-medium tabular-nums sm:text-base">₹{account.amount}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Example balances</p>
              </CardFooter>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
