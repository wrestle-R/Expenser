"use client"

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { HeroHeader } from './header'
import { ChevronRight, Wallet, TrendingUp, CreditCard, IndianRupee, PiggyBank, ArrowRightLeft } from 'lucide-react'
import { SignedIn, SignedOut } from '@clerk/nextjs'
import Image from 'next/image'

export default function HeroSection() {
    return (
        <>
            <HeroHeader />
            <main className="overflow-hidden">
                <section className="bg-background">
                    <div className="relative py-32 md:py-40">
                        <div className="mask-radial-from-45% mask-radial-to-75% mask-radial-at-top mask-radial-[75%_100%] aspect-2/3 absolute inset-0 opacity-75 blur-xl md:aspect-square lg:aspect-video dark:opacity-5">
                            <Image
                                src="https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?q=80&w=2071&auto=format&fit=crop"
                                alt="hero background"
                                width={2071}
                                height={1380}
                                className="h-full w-full object-cover object-top"
                            />
                        </div>
                        <div className="relative z-10 mx-auto w-full max-w-7xl px-6">
                            <div className="flex items-center justify-between gap-12 max-md:flex-col">
                                <div className="max-w-lg max-sm:px-0">
                                    <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground mb-6">
                                        <Wallet className="size-3.5" />
                                        <span>Personal Finance Tracker</span>
                                    </div>
                                    <h1 className="text-balance font-sans text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                                        Track Every <span className="text-primary">Rupee</span>, Effortlessly.
                                    </h1>
                                    <p className="text-muted-foreground mt-6 text-balance text-base sm:text-lg leading-relaxed">
                                        Manage your bank, cash, and splitwise balances in one place. 
                                        Log transactions instantly and always know where your money goes.
                                    </p>

                                    <div className="mt-8 flex gap-3">
                                        <SignedOut>
                                            <Button size="lg" className="pr-2" render={<Link href="/sign-up" />} nativeButton={false}>
                                                <span className="text-nowrap">Get Started Free</span>
                                                <ChevronRight className="opacity-50" />
                                            </Button>
                                            <Button size="lg" variant="outline" render={<Link href="/sign-in" />} nativeButton={false}>
                                                <span>Sign In</span>
                                            </Button>
                                        </SignedOut>
                                        <SignedIn>
                                            <Button size="lg" className="pr-2" render={<Link href="/dashboard" />} nativeButton={false}>
                                                <span className="text-nowrap">Go to Dashboard</span>
                                                <ChevronRight className="opacity-50" />
                                            </Button>
                                        </SignedIn>
                                    </div>
                                </div>
                                <div
                                    aria-hidden
                                    className="mask-y-from-50% relative max-md:mx-auto max-md:*:scale-90 max-md:mt-8">
                                    {[
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
                                    ].map((prompt, index) => (
                                        <div
                                            key={index}
                                            className="text-muted-foreground flex items-center gap-3 px-12 py-2.5 text-sm">
                                            <div className="size-1.5 rounded-full bg-primary/40 flex-shrink-0" />
                                            <span className="text-nowrap">{prompt}</span>
                                        </div>
                                    ))}
                                    <div className="bg-card min-w-sm ring-border shadow-lg absolute inset-0 m-auto mt-auto flex h-fit justify-between gap-4 rounded-2xl p-4 ring-1 sm:inset-2 backdrop-blur-sm">
                                        <div className="grid grid-cols-3 gap-3 w-full">
                                            <div className="flex flex-col items-center gap-1.5 rounded-xl bg-blue-500/10 p-3">
                                                <CreditCard className="size-5 text-blue-500" />
                                                <div className="text-center">
                                                    <p className="text-xs text-muted-foreground">Bank</p>
                                                    <p className="text-sm font-bold flex items-center justify-center gap-0.5">
                                                        <IndianRupee className="size-3" />15k
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-center gap-1.5 rounded-xl bg-emerald-500/10 p-3">
                                                <PiggyBank className="size-5 text-emerald-500" />
                                                <div className="text-center">
                                                    <p className="text-xs text-muted-foreground">Cash</p>
                                                    <p className="text-sm font-bold flex items-center justify-center gap-0.5">
                                                        <IndianRupee className="size-3" />5.5k
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-center gap-1.5 rounded-xl bg-orange-500/10 p-3">
                                                <ArrowRightLeft className="size-5 text-orange-500" />
                                                <div className="text-center">
                                                    <p className="text-xs text-muted-foreground">Split</p>
                                                    <p className="text-sm font-bold flex items-center justify-center gap-0.5">
                                                        <IndianRupee className="size-3" />4k
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </>
    )
}
