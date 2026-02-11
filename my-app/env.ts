// Environment configuration for the Expenser app
// Replace these values with your actual API URL and Clerk publishable key

export const ENV = {
  // API base URL - pointing to your Next.js API
  // For development, use your local network IP if testing on a device
  // For production, use your deployed API URL
  API_URL: process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000",

  // Clerk publishable key - get this from your Clerk dashboard
  CLERK_PUBLISHABLE_KEY:
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_Z3VpZGluZy1jYWltYW4tNjIuY2xlcmsuYWNjb3VudHMuZGV2JA",
};
