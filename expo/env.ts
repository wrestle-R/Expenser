// Environment configuration for the Expenser app
// Replace these values with your actual API URL and Clerk publishable key
import { Platform } from "react-native";

// IMPORTANT: For Expo Go on physical device with mobile hotspot:
// 1. Find your computer's local IP: `ifconfig | grep "inet "`
// 2. Set EXPO_PUBLIC_API_URL=http://YOUR_IP:3000 in .env file
// Example: EXPO_PUBLIC_API_URL=http://192.168.1.100:3000

function getApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    console.log("[ENV] Using API URL from env:", envUrl);
    return envUrl;
  }

  // Default fallback - use production URL
  const defaultUrl = "https://expenser-rdp.vercel.app";
  console.warn("[ENV] No EXPO_PUBLIC_API_URL set. Using default:", defaultUrl);
  return defaultUrl;
}

export const ENV = {
  API_URL: getApiUrl(),
  CLERK_PUBLISHABLE_KEY:
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_Z3VpZGluZy1jYWltYW4tNjIuY2xlcmsuYWNjb3VudHMuZGV2JA",
};

