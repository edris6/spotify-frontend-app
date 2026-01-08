// lib/spotifyAuth.ts
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "spotify_token_v1";

export const SPOTIFY_CONFIG = {
  clientId: "571be780d07f41cfb5f8b56e7e3f2e58",
  authorizationEndpoint: "https://accounts.spotify.com/authorize",
  tokenEndpoint: "https://accounts.spotify.com/api/token",
  redirectUri: AuthSession.makeRedirectUri({
    scheme: "my-album-app-login",
    path: "callback",
  }),
  scopes: ["user-read-currently-playing"], // add "user-read-playback-state" if you want
};

export type StoredToken = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  obtained_at: number; // epoch ms
};

export async function getStoredToken(): Promise<StoredToken | null> {
  const raw = await SecureStore.getItemAsync(TOKEN_KEY);
  return raw ? (JSON.parse(raw) as StoredToken) : null;
}

export async function storeToken(t: StoredToken): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(t));
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export function isExpired(t: StoredToken): boolean {
  const expiresAt = t.obtained_at + t.expires_in * 1000;
  return Date.now() > expiresAt - 30_000; // refresh early
}

export async function loginWithSpotify(): Promise<StoredToken> {
  const request = new AuthSession.AuthRequest({
    clientId: SPOTIFY_CONFIG.clientId,
    redirectUri: SPOTIFY_CONFIG.redirectUri,
    scopes: SPOTIFY_CONFIG.scopes,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
  });

  await request.makeAuthUrlAsync({
    authorizationEndpoint: SPOTIFY_CONFIG.authorizationEndpoint,
  });

  const result = await request.promptAsync(
    { authorizationEndpoint: SPOTIFY_CONFIG.authorizationEndpoint },
    { useProxy: false }
  );

  if (result.type !== "success" || !result.params.code) {
    throw new Error(`Spotify login failed: ${result.type}`);
  }

  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId: SPOTIFY_CONFIG.clientId,
      code: result.params.code,
      redirectUri: SPOTIFY_CONFIG.redirectUri,
      extraParams: { code_verifier: request.codeVerifier ?? "" },
    },
    { tokenEndpoint: SPOTIFY_CONFIG.tokenEndpoint }
  );

  const stored: StoredToken = {
    ...tokenResult,
    obtained_at: Date.now(),
  };

  await storeToken(stored);
  return stored;
}

export async function refreshSpotifyToken(t: StoredToken): Promise<StoredToken> {
  if (!t.refresh_token) throw new Error("No refresh_token available");

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", t.refresh_token);
  body.set("client_id", SPOTIFY_CONFIG.clientId);

  const res = await fetch(SPOTIFY_CONFIG.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Refresh failed: ${res.status} ${text}`);
  }

  const refreshed = (await res.json()) as {
    access_token: string;
    token_type: string;
    scope?: string;
    expires_in: number;
    refresh_token?: string;
  };

  const merged: StoredToken = {
    ...t,
    ...refreshed,
    refresh_token: refreshed.refresh_token ?? t.refresh_token,
    obtained_at: Date.now(),
  };

  await storeToken(merged);
  return merged;
}
