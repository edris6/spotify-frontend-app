import React, { useEffect, useState } from "react";
import { ActivityIndicator, Button, Image, Text, View } from "react-native";
import { getCurrentlyPlayingAlbum, NowPlayingAlbum } from "../../lib/spotifyApi";
import {
  clearToken,
  getStoredToken,
  isExpired,
  loginWithSpotify,
  refreshSpotifyToken,
  StoredToken,
} from "../../lib/spotifyAuth";

export default function NowPlayingScreen() {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<StoredToken | null>(null);
  const [album, setAlbum] = useState<NowPlayingAlbum | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ensureValidToken(): Promise<StoredToken | null> {
    const t = await getStoredToken();
    if (!t) return null;
    if (isExpired(t)) return await refreshSpotifyToken(t);
    return t;
  }

  async function loadNowPlaying() {
    setError(null);
    try {
      const t = await ensureValidToken();
      setToken(t);

      if (!t) {
        setAlbum(null);
        return;
      }

      const now = await getCurrentlyPlayingAlbum(t.access_token);
      setAlbum(now);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    }
  }

  async function onLogin() {
    setLoading(true);
    setError(null);
    try {
      const t = await loginWithSpotify();
      setToken(t);
      await loadNowPlaying();
    } catch (e: any) {
      setError(e?.message ?? "Login error");
    } finally {
      setLoading(false);
    }
  }

  async function onLogout() {
    await clearToken();
    setToken(null);
    setAlbum(null);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadNowPlaying();
      setLoading(false);
    })();

    const id = setInterval(loadNowPlaying, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={{ flex: 1, padding: 16, justifyContent: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "600", marginBottom: 12 }}>
        Spotify: Currently Playing Album
      </Text>

      {loading && <ActivityIndicator />}

      {!token ? (
        <Button title="Login with Spotify" onPress={onLogin} />
      ) : (
        <View style={{ gap: 10 }}>
          <Button title="Refresh Now Playing" onPress={loadNowPlaying} />
          <Button title="Logout" onPress={onLogout} />
        </View>
      )}

      {error && <Text style={{ marginTop: 12, color: "crimson" }}>{error}</Text>}

      <View style={{ marginTop: 20, alignItems: "center" }}>
        {!album ? (
          <Text>No track is currently playing.</Text>
        ) : (
          <>
            {album.artworkUrl ? (
              <Image
                source={{ uri: album.artworkUrl }}
                style={{ width: 240, height: 240, borderRadius: 12, marginBottom: 12 }}
              />
            ) : null}
            <Text style={{ fontSize: 18, fontWeight: "600", textAlign: "center" }}>
              {album.albumName}
            </Text>
            <Text style={{ fontSize: 14, marginTop: 6 }}>{album.artistName}</Text>
            <Text style={{ marginTop: 6 }}>{album.isPlaying ? "Playing" : "Paused"}</Text>
          </>
        )}
      </View>
    </View>
  );
}
