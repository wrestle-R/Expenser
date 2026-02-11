"use client"

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { HeroHeader } from './header'
import { ChevronRight, Wallet, TrendingUp, CreditCard, IndianRupee, PiggyBank, ArrowRightLeft, CheckCircle2 } from 'lucide-react'
import { SignedIn, SignedOut } from '@clerk/nextjs'
import Image from 'next/image'

export default function HeroSection() {
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

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <HeroHeader />
            <main className="flex-1 flex items-center justify-center pt-24 pb-12">
                <section className="relative w-full">
                    {/* Background Glow */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] dark:bg-primary/5" />
                        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] dark:bg-primary/2" />
                    </div>

                    <div className="relative z-10 mx-auto w-full max-w-6xl px-6">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            <div className="flex flex-col gap-8 max-w-xl">
                                <div className="inline-flex items-center gap-2 w-fit rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary animate-in fade-in slide-in-from-bottom-4 duration-1000">
                                    <Wallet className="size-4" />
                                    <span>Personal Finance tracker</span>
                                </div>
                                
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200">
                                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-balance leading-[1.1]">
                                        Track Every <span className="text-primary italic">Rupee</span>, Effortlessly.
                                    </h1>
                                    <p className="text-xl text-muted-foreground text-balance leading-relaxed">
                                        The most intuitive way to manage your bank, cash, and Splitwise balances in one place. Stay in control of your finances with ease.
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
                                    <SignedOut>
                                        <Button size="lg" className="rounded-full px-8 shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all hover:-translate-y-0.5" render={<Link href="/sign-up" />} nativeButton={false}>
                                            Get Started Free <ChevronRight className="size-4 ml-1" />
                                        </Button>
                                        <Button size="lg" variant="outline" className="rounded-full px-8 hover:bg-primary/5 border-primary/20" render={<Link href="/sign-in" />} nativeButton={false}>
                                            Sign In
                                        </Button>
                                    </SignedOut>
                                    <SignedIn>
                                        <Button size="lg" className="rounded-full px-8 shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all hover:-translate-y-0.5" render={<Link href="/dashboard" />} nativeButton={false}>
                                            Go to Dashboard <ChevronRight className="size-4 ml-1" />
                                        </Button>
                                    </SignedIn>
                                </div>
                            </div>

                            <div className="relative animate-in fade-in slide-in-from-right-10 duration-1000 delay-500">
                                {/* Fabulous Feature Section */}
                                <div className="grid gap-6 p-8 rounded-[2.5rem] border border-border/50 bg-card/50 backdrop-blur-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50" />
                                    
                                    <div className="relative grid sm:grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
                                        {features.map((feature, index) => (
                                            <div key={index} className="flex items-center gap-3 group/item">
                                                <div className="flex-shrink-0 size-6 rounded-full bg-primary/10 flex items-center justify-center group-hover/item:bg-primary group-hover/item:text-primary-foreground transition-all duration-300">
                                                    <CheckCircle2 className="size-3.5" />
                                                </div>
                                                <span className="text-[0.9375rem] font-medium text-muted-foreground group-hover/item:text-foreground transition-colors">
                                                    {feature}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Stats overlay */}
                                    <div className="relative mt-8 pt-8 border-t border-border/50 grid grid-cols-3 gap-4">
                                        {[
                                            { icon: CreditCard, color: 'blue', label: 'Bank', amount: '15k' },
                                            { icon: PiggyBank, color: 'emerald', label: 'Cash', amount: '5.5k' },
                                            { icon: ArrowRightLeft, color: 'orange', label: 'Split', amount: '4k' }
                                        ].map((stat, i) => (
                                            <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors">
                                                <div className={`p-2 rounded-xl bg-${stat.color}-500/10`}>
                                                    <stat.icon className={`size-5 text-${stat.color}-500`} />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{stat.label}</p>
                                                    <p className="text-sm md:text-base font-bold flex items-center justify-center gap-0.5">
                                                        <IndianRupee className="size-3" />{stat.amount}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* Decorative floating elements */}
                                <div className="absolute -top-12 -right-12 size-48 bg-primary/10 rounded-full blur-[100px] -z-10 animate-pulse" />
                                <div className="absolute -bottom-12 -left-12 size-64 bg-primary/5 rounded-full blur-[120px] -z-10" />
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    )
}
