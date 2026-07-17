// AI "get the story" — moving, little-known trivia via Google's Gemini API (free tier).
// Key lives only in the Vercel env var GEMINI_API_KEY.
const MODEL = "gemini-2.0-flash"; // swap here if Google rotates the free model

export default async function handler(req, res) {
  const key = process.env.GEMINI_API_KEY;
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  if (!key) { res.status(200).json({ configured: false }); return; }

  const q = req.query || {};
  const title = (q.title || "").trim();
  if (!title) { res.status(400).json({ error: "no title" }); return; }
  const kind = q.kind || "movie";
  const what = kind === "song" ? "song" : kind === "artist" ? "musician or band" : kind === "tv" ? "TV series" : "film";
  const ctx = (q.year ? " (" + q.year + ")" : "") + (q.sub ? " — " + q.sub : "");

  const prompt =
    "You are a film and music trivia expert with deep, accurate knowledge. For the " + what + ' "' + title + '"' + ctx + ", provide two things:\n" +
    "1. logline: a vivid 2-6 word 'vibe' phrase capturing its feel (e.g. \"touching war story\", \"erotic thriller of betrayal\", \"a hymn for the weary\").\n" +
    "2. trivia: ONE genuinely moving, surprising, and TRUE little-known fact or backstory, 2-4 sentences, the kind that stirs real emotion or awe. Favour the human story (loss, sacrifice, coincidence, what happened to the people) over a plot summary.\n" +
    "Only state facts you are confident are true. If you are unsure of a specific detail, stay general rather than inventing names, dates, or events.\n" +
    'Respond with ONLY strict JSON: {"logline": "...", "trivia": "..."}';

  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent?key=" + key, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.75, responseMimeType: "application/json" }
      })
    });
    const j = await r.json();
    if (j.error) { res.status(200).json({ configured: true, error: j.error.message || "api error" }); return; }
    const text = j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts && j.candidates[0].content.parts[0] && j.candidates[0].content.parts[0].text;
    if (!text) { res.status(200).json({ configured: true, error: "empty response" }); return; }
    let parsed = null; try { parsed = JSON.parse(text); } catch (e) {}
    res.status(200).json({ configured: true, story: parsed || { logline: "", trivia: String(text).trim() } });
  } catch (e) {
    res.status(200).json({ configured: true, error: String(e && e.message || e) });
  }
}
