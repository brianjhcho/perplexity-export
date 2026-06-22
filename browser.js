(async function () {
  var S = "http://localhost:9876", BATCH = 8, DELAY = 250;
  var log = function (m) { console.log("[pplx-export] " + m); };

  // Make sure the local receiver (npx perplexity-export) is running.
  try { await fetch(S + "/thread", { method: "OPTIONS" }); }
  catch (e) { console.error("[pplx-export] Run `npx perplexity-export` first"); return; }

  // ── Discover threads via the list API ──────────────────────────────────────
  // Perplexity's library no longer renders <a href="/search/..."> links (it uses
  // a virtualized list), so DOM scraping returns nothing. list_ask_threads is the
  // reliable source. Note: `slug` is now a UUID.
  var threads = [], offset = 0;
  log("Fetching thread list...");
  while (true) {
    var r = await fetch('/rest/thread/list_ask_threads?version=2.18&source=default', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 100, offset: offset, ascending: false, search_term: '', exclude_asi: false })
    });
    if (!r.ok) { log("list API returned " + r.status + " (are you logged in?)"); break; }
    var page = await r.json();
    if (!Array.isArray(page) || page.length === 0) break;
    for (var i = 0; i < page.length; i++) {
      var t = page[i], slug = t.slug || t.url_slug || t.uuid;
      if (slug) threads.push({ slug: slug, title: t.title || t.query_str || slug });
    }
    offset += 100;
    if (page.length < 100) break;
  }
  log(threads.length + " threads found. Exporting...");
  if (threads.length === 0) return;

  // The assistant answer is stored as a JSON-encoded step list in entry.text.
  function extractAnswer(entry) {
    if (entry.answer && (entry.answer.text || entry.answer.answer)) return entry.answer.text || entry.answer.answer;
    var raw = entry.text;
    if (typeof raw !== "string") return "";
    var steps; try { steps = JSON.parse(raw); } catch (e) { return raw; }
    if (!Array.isArray(steps)) return "";
    var ans = "";
    for (var s = 0; s < steps.length; s++) {
      var c = steps[s].content || {}, cand = c.answer;
      if (cand == null) continue;
      if (typeof cand === "string") { try { var p = JSON.parse(cand); cand = p.answer || p.text || cand; } catch (e) {} }
      if (typeof cand === "object") cand = cand.answer || cand.text || "";
      if (cand) ans = cand; // last answer step is the final one
    }
    return ans;
  }

  // ── Fetch each thread, build messages, send to the local receiver ──────────
  var ok = 0, fail = 0;
  for (var b = 0; b < threads.length; b += BATCH) {
    var batch = threads.slice(b, b + BATCH);
    await Promise.all(batch.map(async function (item) {
      try {
        var rr = await fetch('/rest/thread/' + item.slug + '?version=2.18&source=default&limit=50&offset=0&from_first=true');
        if (!rr.ok) { fail++; return; }
        var d = await rr.json();
        var entries = d.entries || [];
        var messages = [];
        for (var k = 0; k < entries.length; k++) {
          var e = entries[k];
          var q = e.query_str || (e.query && e.query.text) || e.query || "";
          var a = extractAnswer(e);
          var ts = e.updated_datetime || e.created_datetime || "";
          if (q) messages.push({ sender: "human", text: String(q), created_at: ts });
          if (a) messages.push({ sender: "assistant", text: String(a), created_at: ts });
        }
        if (messages.length === 0) { fail++; return; }
        await fetch(S + "/thread", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: (d.thread_metadata && d.thread_metadata.title) || item.title,
            slug: item.slug, source: "perplexity",
            url: "https://www.perplexity.ai/search/" + item.slug,
            exported_at: new Date().toISOString(),
            chat_messages: messages
          })
        });
        ok++;
      } catch (e) { fail++; }
    }));
    log(Math.min(b + BATCH, threads.length) + "/" + threads.length + " — " + ok + " saved, " + fail + " failed");
    await new Promise(function (r) { setTimeout(r, DELAY); });
  }
  await fetch(S + "/done", { method: "POST" });
  log("DONE: " + ok + " threads exported.");
})();
