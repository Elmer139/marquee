// Serverless proxy for The Movie Database (TMDB).
// The API key lives only in the Vercel env var TMDB_API_KEY — never in the public repo or the browser.
export default async function handler(req, res) {
  const key = process.env.TMDB_API_KEY;
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=86400");
  if (!key) { res.status(200).json({ configured: false }); return; }

  const q = req.query || {};
  const action = q.action || "search";
  const img = (p, size) => (p ? "https://image.tmdb.org/t/p/" + (size || "w500") + p : null);
  const api = "https://api.themoviedb.org/3";
  const withKey = (path, extra) => api + path + "?api_key=" + key + (extra ? "&" + extra : "");

  try {
    if (action === "search") {
      const kind = q.kind === "tv" ? "tv" : q.kind === "movie" ? "movie" : "multi";
      const r = await fetch(withKey("/search/" + kind, "include_adult=false&query=" + encodeURIComponent(q.q || "")));
      const j = await r.json();
      const results = (j.results || [])
        .filter((it) => kind !== "multi" || it.media_type === "movie" || it.media_type === "tv")
        .slice(0, 12)
        .map((it) => {
          const mt = it.media_type || kind;
          const date = it.release_date || it.first_air_date || "";
          return { id: it.id, kind: mt, title: it.title || it.name, year: date ? date.slice(0, 4) : "", overview: it.overview || "", poster: img(it.poster_path, "w342") };
        });
      res.status(200).json({ configured: true, results });
      return;
    }

    if (action === "details") {
      const kind = q.kind === "tv" ? "tv" : "movie";
      const r = await fetch(withKey("/" + kind + "/" + encodeURIComponent(q.id), "append_to_response=credits,videos"));
      const d = await r.json();
      const date = d.release_date || d.first_air_date || "";
      let director = "";
      if (kind === "movie") director = ((d.credits && d.credits.crew) || []).filter((c) => c.job === "Director").map((c) => c.name).slice(0, 2).join(", ");
      else director = (d.created_by || []).map((c) => c.name).slice(0, 2).join(", ");
      const cast = ((d.credits && d.credits.cast) || []).slice(0, 3).map((c) => c.name).join(", ");
      const sub = director && cast ? director + " · " + cast : (director || cast);
      const vids = ((d.videos && d.videos.results) || []).filter((v) => v.site === "YouTube");
      const t = vids.filter((v) => v.type === "Trailer")[0] || vids[0];
      res.status(200).json({
        configured: true,
        details: {
          title: d.title || d.name,
          year: date ? date.slice(0, 4) : "",
          sub, director, cast,
          genres: (d.genres || []).map((g) => g.name),
          overview: d.overview || "",
          poster: img(d.poster_path, "w500"),
          trailer: t ? "https://www.youtube.com/watch?v=" + t.key : null,
          kind
        }
      });
      return;
    }

    res.status(400).json({ error: "unknown action" });
  } catch (e) {
    res.status(200).json({ configured: true, error: String(e && e.message || e) });
  }
}
