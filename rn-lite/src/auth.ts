import AsyncStorage from "@react-native-async-storage/async-storage";
import { getClerkFrontendApi } from "./config";

const AUTH_STORAGE_KEY = "expenser-lite-auth";

interface AuthState {
  clientToken?: string;
  sessionId?: string;
  sessionToken: string;
  sessionTokenExpiresAt?: number;
  manual?: boolean;
}

interface ClerkResponse {
  response?: any;
  meta?: { client?: any };
  errors?: Array<{ message?: string; long_message?: string }>;
}

let state: AuthState | null = null;

function encodeForm(input: Record<string, string>) {
  return Object.entries(input)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

function getAuthHeader(response: Response) {
  return response.headers.get("authorization") || response.headers.get("Authorization");
}

async function clerkFetch(path: string, init: RequestInit = {}, clientToken?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    ...((init.headers as Record<string, string>) || {}),
  };
  if (clientToken) {
    headers.Authorization = clientToken;
  }

  const response = await fetch(`https://${getClerkFrontendApi()}${path}`, {
    ...init,
    headers,
  });
  const json = (await response.json().catch(() => ({}))) as ClerkResponse;
  const nextClientToken = getAuthHeader(response) || clientToken;
  if (!response.ok) {
    const error = json.errors?.[0];
    throw new Error(error?.long_message || error?.message || `Clerk request failed: ${response.status}`);
  }
  return { json, clientToken: nextClientToken };
}

async function createClient() {
  const { json, clientToken } = await clerkFetch("/v1/client");
  const client = json.response;
  if (!clientToken || !client?.id) {
    throw new Error("Clerk did not return a client token.");
  }
  return { client, clientToken };
}

async function requestSessionToken(clientToken: string, sessionId: string) {
  const { json, clientToken: nextClientToken } = await clerkFetch(
    `/v1/client/sessions/${sessionId}/tokens`,
    { method: "POST", body: "" },
    clientToken
  );
  const token = json.response?.jwt || json.response?.token || json.response?.session_token || json.response;
  if (typeof token !== "string") {
    throw new Error("Clerk did not return a session token.");
  }
  return { sessionToken: token, clientToken: nextClientToken };
}

export async function loadAuthState() {
  if (state) {
    return state;
  }
  const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
  state = raw ? (JSON.parse(raw) as AuthState) : null;
  return state;
}

async function saveAuthState(nextState: AuthState | null) {
  state = nextState;
  if (nextState) {
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextState));
  } else {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

export async function signInWithPassword(identifier: string, password: string) {
  const { clientToken } = await createClient();
  const { json, clientToken: afterSignInToken } = await clerkFetch(
    "/v1/client/sign_ins",
    {
      method: "POST",
      body: encodeForm({ identifier, password }),
    },
    clientToken
  );
  const signIn = json.response || json.meta?.client?.sign_in;
  if (signIn?.status !== "complete" || !signIn?.created_session_id) {
    throw new Error(`Sign in did not complete. Status: ${signIn?.status || "unknown"}`);
  }
  const sessionId = String(signIn.created_session_id);
  const signedClientToken = afterSignInToken || clientToken;

  const tokenResult = await requestSessionToken(signedClientToken, sessionId);
  const nextState: AuthState = {
    clientToken: tokenResult.clientToken,
    sessionId,
    sessionToken: tokenResult.sessionToken,
    sessionTokenExpiresAt: Date.now() + 50000,
  };
  await saveAuthState(nextState);
  return nextState;
}

export async function signInWithSessionToken(token: string) {
  const nextState: AuthState = { sessionToken: token.trim(), manual: true };
  await saveAuthState(nextState);
  return nextState;
}

export async function getSessionToken() {
  const current = await loadAuthState();
  if (!current) {
    return null;
  }
  if (
    current.clientToken &&
    current.sessionId &&
    (!current.sessionTokenExpiresAt || current.sessionTokenExpiresAt - Date.now() < 10000)
  ) {
    try {
      const tokenResult = await requestSessionToken(current.clientToken, current.sessionId);
      const refreshed = {
        ...current,
        clientToken: tokenResult.clientToken,
        sessionToken: tokenResult.sessionToken,
        sessionTokenExpiresAt: Date.now() + 50000,
      };
      await saveAuthState(refreshed);
      return refreshed.sessionToken;
    } catch {
      return current.sessionToken;
    }
  }
  return current.sessionToken;
}

export async function signOut() {
  await saveAuthState(null);
}
