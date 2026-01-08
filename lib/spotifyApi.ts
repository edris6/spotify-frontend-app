// lib/spotifyApi.ts
export type NowPlayingAlbum = {
  albumName: string;
  artistName: string;
  artworkUrl?: string;
  isPlaying: boolean;
};

export async function getCurrentlyPlayingAlbum(
  accessToken: string
): Promise<NowPlayingAlbum | null> {
  const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 204) return null;

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Currently playing failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const item = data?.item;
  const album = item?.album;
  const artists = item?.artists;

  return {
    albumName: album?.name ?? "Unknown album",
    artistName: artists?.[0]?.name ?? "Unknown artist",
    artworkUrl: album?.images?.[0]?.url,
    isPlaying: Boolean(data?.is_playing),
  };
}
