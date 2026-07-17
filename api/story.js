// AI "get the story" — moving, little-known trivia via Groq (free, no card).
// Key lives only in the Vercel env var GROQ_API_KEY.
const MODEL = "llama-3.3-70b-versatile"; // swap here if Groq rotates the free model

export default async function handler(req, res) {
  const key = process.env.GROQ_API_KEY;
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  if (!key) { res.status(200).json({ configured: false }); return; }

  const q = req.query || {};
  const title = (q.title || "").trim();
  if (!title) { res.status(400).json({ error: "no title" }); return; }
  const kind = q.kind || "movie";
  const what = kind === "song" ? "song" : kind === "artist" ? "musician or band" : kind === "tv" ? "TV series" : "film";
  const ctx = (q.year ? " (" + q.year + ")" : "") + (q.sub ? " — " + q.sub : "");

  const system = "You are a film and music expert with deep, accurate knowledge who surfaces the moving, little-known human stories behind works of art. You never invent facts; if unsure of a specific detail, stay general rather than making up names, dates, or events. You respond with strict JSON only.";
  const user =
    'For the ' + what + ' "' + title + '"' + ctx + ", give me two things:\n" +
    '1. "logline": a vivid, SPECIFIC 2-6 word phrase capturing its essence (e.g. "Vietnam war tragedy", "a con artist\'s unraveling", "grief on a distant planet"). Specific to THIS work, never generic like "a thrilling film".\n' +
    '2. "trivia": ONE genuinely moving, surprising, TRUE, little-known fact or backstory, 2-4 sentences, the kind that stirs real emotion or awe. Favour the human story (loss, sacrifice, coincidence, what happened to the people) over plot summary.\n' +
    'Respond with ONLY JSON: {"logline": "...", "trivia": "..."}';

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: 0.75,
        response_format: { type: "json_object" }
      })
    });
    const j = await r.json();
    if (j.error) { res.status(200).json({ configured: true, error: (j.error.message || "api error") }); return; }
    const text = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!text) { res.status(200).json({ configured: true, error: "empty response" }); return; }
    let parsed = null; try { parsed = JSON.parse(text); } catch (e) {}
    res.status(200).json({ configured: true, story: parsed || { logline: "", trivia: String(text).trim() } });
  } catch (e) {
    res.status(200).json({ configured: true, error: String(e && e.message || e) });
  }
}
