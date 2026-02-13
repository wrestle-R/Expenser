# Expenser

A minimal expense tracking app that works offline-first across mobile and web.

## What is Expenser?

Expenser helps you track your income and expenses across multiple payment methods (Bank, Cash, Splitwise). It works seamlessly offline and syncs your data when you're back online.

## Features

- **Offline-First**: Add transactions anytime, sync when online
- **Multiple Payment Methods**: Track Bank (UPI), Cash, and Splitwise balances separately
- **Split Tracking**: Record shared expenses with automatic splitwise balance updates
- **Workflows**: Create quick templates for recurring transactions
- **Edit & Delete**: Modify or remove transactions anytime
- **Delete Confirmation**: Confirmation modals with glassmorphic design
- **Profile Settings**: Manage your personal information and payment methods
- **Real-time Sync**: Automatic synchronization when connection is restored
- **Smart Notifications**: Get reminded about unsynced data
- **Dark Mode**: Built-in dark mode support

## App Components

### Mobile (React Native + Expo)
- **Authentication**: Clerk-based sign in/up
- **Home Dashboard**: Overview of balances and recent transactions
- **Transactions**: View, add, edit, and delete transactions
- **Workflows**: Manage templates for quick transaction creation
- **Profile**: Personal settings and payment method configuration

### Web (Next.js)
- **Dashboard**: Financial overview and recent activity
- **Transactions**: Full transaction management with edit/delete
- **Workflows**: Create and manage transaction templates
- **Profile**: User settings and configuration
- **Analytics**: Some insight into where your money is going

## Where It's Hosted

### Web
- Hosted at: **https://expenser-rdp.vercel.app**

### Mobile
- Download APK: **application-a2b0c570-ac23-4bc2-8987-a1e5fe73ff3f.apk**

## Tech Stack

- **Frontend**: React Native (Mobile), Next.js (Web)
- **Authentication**: Clerk
- **Database**: MongoDB

---

**Simple. Minimal. Effective.**
