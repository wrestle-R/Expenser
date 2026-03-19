// Environment configuration for the Expenser RN CLI app
// Uses hardcoded defaults with env override capability

import {
  API_URL as DOTENV_API_URL,
  CLERK_PUBLISHABLE_KEY as DOTENV_CLERK_PUBLISHABLE_KEY,
} from '@env';

const DEFAULT_API_URL = 'https://expenser-rdp.vercel.app';
const DEFAULT_CLERK_KEY =
  'pk_test_Z3VpZGluZy1jYWltYW4tNjIuY2xlcmsuYWNjb3VudHMuZGV2JA';

function validateUrl(url: string): boolean {
  return /^https?:\/\/.+/.test(url);
}

function getApiUrl(): string {
  const envUrl = DOTENV_API_URL;
  if (envUrl && validateUrl(envUrl)) {
    console.log('[ENV] Using API URL from env:', envUrl);
    return envUrl;
  }
  console.log('[ENV] Using default API URL:', DEFAULT_API_URL);
  return DEFAULT_API_URL;
}

function getClerkKey(): string {
  const envKey = DOTENV_CLERK_PUBLISHABLE_KEY;
  if (envKey && envKey.startsWith('pk_')) {
    console.log('[ENV] Using Clerk key from env');
    return envKey;
  }
  console.log('[ENV] Using default Clerk key');
  return DEFAULT_CLERK_KEY;
}

export const ENV = {
  API_URL: getApiUrl(),
  CLERK_PUBLISHABLE_KEY: getClerkKey(),
} as const;

// Startup validation
export function validateEnv(): {valid: boolean; errors: string[]} {
  const errors: string[] = [];
  if (!validateUrl(ENV.API_URL)) {
    errors.push(`Invalid API_URL: ${ENV.API_URL}`);
  }
  if (!ENV.CLERK_PUBLISHABLE_KEY.startsWith('pk_')) {
    errors.push('CLERK_PUBLISHABLE_KEY missing or invalid prefix');
  }
  return {valid: errors.length === 0, errors};
}
