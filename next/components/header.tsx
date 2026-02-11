'use client'
import Link from 'next/link'
import { Menu, X, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import React from 'react'
import { cn } from '@/lib/utils'
import { SignedIn, SignedOut } from '@clerk/nextjs'

export const HeroHeader = () => {
    const [menuState, setMenuState] = React.useState(false)

    return (
        <header>
            <nav
                data-state={menuState && 'active'}
                className="fixed z-20 w-full bg-background/75 border-b border-border/40 backdrop-blur-lg">
                <div className="mx-auto max-w-6xl px-6">
                    <div className="relative flex flex-wrap items-center justify-between gap-6 py-4 lg:gap-0">
                        <div className="flex w-full justify-between gap-6 lg:w-auto">
                            <Link
                                href="/"
                                aria-label="home"
                                className="flex items-center space-x-2">
                                <Wallet className="size-6 text-primary" />
                                <span className="text-xl font-bold">Expenser</span>
                            </Link>

                            <div className="flex items-center gap-2 lg:hidden">
                                <ThemeToggle />
                                <button
                                    onClick={() => setMenuState(!menuState)}
                                    aria-label={menuState ? 'Close Menu' : 'Open Menu'}
                                    className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5">
                                    <Menu className="in-data-[state=active]:rotate-180 in-data-[state=active]:scale-0 in-data-[state=active]:opacity-0 m-auto size-6 duration-200" />
                                    <X className="in-data-[state=active]:rotate-0 in-data-[state=active]:scale-100 in-data-[state=active]:opacity-100 absolute inset-0 m-auto size-6 -rotate-180 scale-0 opacity-0 duration-200" />
                                </button>
                            </div>
                        </div>

                        <div className="bg-background in-data-[state=active]:block lg:in-data-[state=active]:flex mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 rounded-3xl border p-6 shadow-2xl shadow-zinc-300/20 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-4 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none dark:shadow-none dark:lg:bg-transparent">
                            <div className="hidden lg:block">
                                <ThemeToggle />
                            </div>
                            <div className="flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 md:w-fit">
                                <SignedOut>
                                    <Button variant="ghost" size="sm" render={<Link href="/sign-in" />} nativeButton={false}><span>Login</span></Button>
                                    <Button size="sm" render={<Link href="/sign-up" />} nativeButton={false}><span>Sign Up</span></Button>
                                </SignedOut>
                                <SignedIn>
                                    <Button size="sm" render={<Link href="/dashboard" />} nativeButton={false}><span>Dashboard</span></Button>
                                </SignedIn>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
        </header>
    )
}
