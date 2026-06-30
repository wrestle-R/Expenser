"use client"

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { HeroHeader } from './header'
import { ChevronRight, Wallet, CreditCard, IndianRupee, PiggyBank, ArrowRightLeft, CheckCircle2 } from 'lucide-react'
import { useUserContext } from '@/context/UserContext'

export default function HeroSection() {
    const { isSignedIn } = useUserContext()
    const features = [
        'Track daily expenses across cash and bank',
        'Monitor splitwise balances in real-time',
        'View total balance across all accounts',
        'Add income and expense transactions',
        'Categorize spending by payment method',
        'Check bank account balance instantly',
        'Manage cash transactions efficiently',
        'Split bills with friends easily',
        'Get insights on spending patterns',
        'Record every transaction seamlessly',
        'View transaction history by date',
        'Keep finances organized in one place',
    ];
    const stats = [
        { icon: CreditCard, iconClass: 'bg-blue-500/10 text-blue-500', label: 'Bank', amount: '15k' },
        { icon: PiggyBank, iconClass: 'bg-emerald-500/10 text-emerald-500', label: 'Cash', amount: '5.5k' },
        { icon: ArrowRightLeft, iconClass: 'bg-orange-500/10 text-orange-500', label: 'Split', amount: '4k' },
    ];

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <HeroHeader />
            <main className="flex flex-1 items-center justify-center px-4 pt-24 pb-8 sm:px-6 sm:pt-28 sm:pb-12">
                <section className="w-full">
                    <div className="mx-auto w-full max-w-6xl">
                        <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.95fr] lg:gap-14">
                            <div className="flex max-w-xl flex-col gap-7">
                                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-1000">
                                    <Wallet className="size-4" />
                                    <span>Personal Finance tracker</span>
                                </div>

                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200">
                                    <h1 className="text-4xl font-extrabold leading-[1.08] text-balance sm:text-5xl lg:text-7xl">
                                        Track Every <span className="text-primary italic">Rupee</span>, Effortlessly.
                                    </h1>
                                    <p className="max-w-lg text-base leading-relaxed text-muted-foreground text-balance sm:text-lg">
                                        The most intuitive way to manage your bank, cash, and Splitwise balances in one place. Stay in control of your finances with ease.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 sm:flex-row sm:flex-wrap">
                                    {!isSignedIn ? (
                                      <>
                                        <Button size="lg" className="w-full rounded-full px-8 shadow-sm transition-all hover:-translate-y-0.5 sm:w-auto" render={<Link href="/sign-up" />} nativeButton={false}>
                                            Get Started Free <ChevronRight className="size-4 ml-1" />
                                        </Button>
                                        <Button size="lg" variant="outline" className="w-full rounded-full border-border px-8 hover:bg-muted sm:w-auto" render={<Link href="/sign-in" />} nativeButton={false}>
                                            Sign In
                                        </Button>
                                      </>
                                    ) : (
                                        <Button size="lg" className="w-full rounded-full px-8 shadow-sm transition-all hover:-translate-y-0.5 sm:w-auto" render={<Link href="/dashboard" />} nativeButton={false}>
                                            Go to Dashboard <ChevronRight className="size-4 ml-1" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="relative animate-in fade-in slide-in-from-right-10 duration-1000 delay-500">
                                <div className="grid gap-6 rounded-lg border bg-card p-5 shadow-lg shadow-black/5 sm:p-7 dark:shadow-black/20">
                                    <div className="grid gap-3 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-4">
                                        {features.map((feature, index) => (
                                            <div key={feature} className={`${index >= 6 ? 'hidden sm:flex' : 'flex'} group/item items-center gap-3`}>
                                                <div className="flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-all duration-300 group-hover/item:bg-primary group-hover/item:text-primary-foreground">
                                                    <CheckCircle2 className="size-3.5" />
                                                </div>
                                                <span className="text-sm font-medium leading-snug text-muted-foreground transition-colors group-hover/item:text-foreground sm:text-[0.9375rem]">
                                                    {feature}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 border-t pt-5 sm:gap-4 sm:pt-6">
                                        {stats.map((stat) => (
                                            <div key={stat.label} className="flex min-w-0 flex-col items-center gap-2 rounded-md p-2.5 transition-colors hover:bg-muted/40 sm:p-3">
                                                <div className={`rounded-lg p-2 ${stat.iconClass}`}>
                                                    <stat.icon className="size-4 sm:size-5" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">{stat.label}</p>
                                                    <p className="flex items-center justify-center gap-0.5 text-sm font-bold sm:text-base">
                                                        <IndianRupee className="size-3" />{stat.amount}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    )
}
