// Music search + cover art via the free iTunes Search API (no key). Proxied to avoid browser CORS.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
  const q = req.query || {};
  const term = q.q || "";
  const entity = q.kind === "album" ? "album" : q.kind === "artist" ? "musicArtist" : "song";
  const limit = Math.min(parseInt(q.limit, 10) || 3, 15);
  try {
    const r = await fetch("https://itunes.apple.com/search?media=music&entity=" + entity + "&limit=" + limit + "&term=" + encodeURIComponent(term));
    const j = await r.json();
    const results = (j.results || []).map((it) => {
      let art = it.artworkUrl100 || it.artworkUrl60 || null;
      if (art) art = art.replace(/\/\d+x\d+bb\./, "/600x600bb."); // request a bigger render
      return {
        title: it.trackName || it.collectionName || it.artistName,
        artist: it.artistName || "",
        album: it.collectionName || null,
        year: (it.releaseDate || "").slice(0, 4),
        genre: it.primaryGenreName || null,
        kind: entity === "album" ? "album" : entity === "musicArtist" ? "artist" : "song",
        art
      };
    }).filter((x) => x.title);
    res.status(200).json({ results });
  } catch (e) {
    res.status(200).json({ results: [], error: String(e && e.message || e) });
  }
}
