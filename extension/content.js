// Content script — runs on perplexity.ai pages
// Listens for export command from popup, does the actual work

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.action === 'startExport') {
    runExport();
  }
});

async function runExport() {
  var BATCH = 10;
  var DELAY = 200;
  var SCROLL_PAUSE = 800;
  var MAX_STABLE = 15;

  try {
    // ── Step 1: Navigate to library if not there ─────────────────────────────
    if (!window.location.pathname.includes('/library')) {
      window.location.href = 'https://www.perplexity.ai/library';
      // Wait for navigation
      await new Promise(function(r) { setTimeout(r, 3000); });
    }

    // ── Step 2: Collect slugs from BOTH scroll AND list API ──────────────────
    var slugMap = {};

    // 2a: List API (gets ~600 "ask" threads)
    chrome.runtime.sendMessage({ type: 'scroll-progress', count: 0 });
    try {
      var offset = 0;
      while (true) {
        var listRes = await fetch('/rest/thread/list_ask_threads?version=2.18&source=default', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: 100, offset: offset, ascending: false, search_term: '', exclude_asi: false })
        });
        if (!listRes.ok) break;
        var listData = await listRes.json();
        if (!Array.isArray(listData) || listData.length === 0) break;
        for (var k = 0; k < listData.length; k++) {
          var t = listData[k];
          var s = t.slug || t.url_slug;
          if (s) slugMap[s] = t.title || t.query || s;
        }
        offset += 100;
        if (listData.length < 100) break;
      }
    } catch (e) { /* API not available, rely on scroll */ }

    chrome.runtime.sendMessage({ type: 'scroll-progress', count: Object.keys(slugMap).length });

    // 2b: Scroll DOM (catches all thread types the API misses)
    var stableCount = 0;
    var prevCount = 0;

    for (var i = 0; i < 600 && stableCount < MAX_STABLE; i++) {
      window.scrollTo(0, document.body.scrollHeight);
      var containers = document.querySelectorAll('[class*="overflow"], main, [role="main"]');
      for (var c = 0; c < containers.length; c++) containers[c].scrollTop = containers[c].scrollHeight;
      await new Promise(function(r) { setTimeout(r, SCROLL_PAUSE); });

      var links = document.querySelectorAll('a[href*="/search/"]');
      for (var j = 0; j < links.length; j++) {
        var href = links[j].getAttribute('href');
        if (href) {
          var slug = href.replace('/search/', '');
          if (!slugMap[slug]) {
            slugMap[slug] = links[j].textContent.trim().slice(0, 200) || slug;
          }
        }
      }

      var currentCount = Object.keys(slugMap).length;
      if (currentCount === prevCount) stableCount++;
      else { stableCount = 0; prevCount = currentCount; }

      if (i % 20 === 0) {
        chrome.runtime.sendMessage({ type: 'scroll-progress', count: currentCount });
      }
    }

    var allSlugs = Object.keys(slugMap);
    var allTitles = slugMap;

    chrome.runtime.sendMessage({ type: 'scroll-progress', count: allSlugs.length });

    if (allSlugs.length === 0) {
      chrome.runtime.sendMessage({ type: 'error', message: 'No threads found. Make sure you are logged in.' });
      return;
    }

    // ── Step 3: Fetch each thread via API ────────────────────────────────────
    var allThreads = [];
    var saved = 0;
    var failed = 0;

    for (var i = 0; i < allSlugs.length; i += BATCH) {
      var batch = allSlugs.slice(i, i + BATCH);

      var results = await Promise.all(batch.map(function(slug) {
        return fetch('/rest/thread/' + slug + '?version=2.18&source=default&limit=50&offset=0&from_first=true')
          .then(function(r) { return r.ok ? r.json().then(function(d) { return { slug: slug, data: d }; }) : null; })
          .catch(function() { return null; });
      }));

      for (var r = 0; r < results.length; r++) {
        var result = results[r];
        if (!result || !result.data) { failed++; continue; }

        var data = result.data;
        var entries = data.entries || data.messages || [];
        var messages = [];

        for (var e = 0; e < entries.length; e++) {
          var entry = entries[e];
          var q = (entry.query && entry.query.text) || entry.query || '';
          var a = (entry.answer && entry.answer.text) || (entry.answer && entry.answer.answer) || (typeof entry.answer === 'string' ? entry.answer : '') || entry.text || '';
          if (q) messages.push({ sender: 'human', text: String(q), created_at: entry.created_at || '' });
          if (a) messages.push({ sender: 'assistant', text: String(a), created_at: entry.created_at || '' });
        }

        if (messages.length === 0) { failed++; continue; }

        allThreads.push({
          title: data.title || allTitles[result.slug] || result.slug,
          slug: result.slug,
          source: 'perplexity',
          url: 'https://www.perplexity.ai/search/' + result.slug,
          exported_at: new Date().toISOString(),
          chat_messages: messages
        });
        saved++;
      }

      chrome.runtime.sendMessage({
        type: 'fetch-progress',
        done: Math.min(i + BATCH, allSlugs.length),
        total: allSlugs.length,
        saved: saved,
        failed: failed
      });

      if (i + BATCH < allSlugs.length) {
        await new Promise(function(r) { setTimeout(r, DELAY); });
      }
    }

    // ── Step 4: Download as zip-like chunked JSONs ───────────────────────────
    // Split into chunks of 100 threads to avoid massive single files
    var CHUNK_SIZE = 100;
    for (var c = 0; c < allThreads.length; c += CHUNK_SIZE) {
      var chunk = allThreads.slice(c, c + CHUNK_SIZE);
      var chunkNum = Math.floor(c / CHUNK_SIZE) + 1;
      var totalChunks = Math.ceil(allThreads.length / CHUNK_SIZE);
      var filename = totalChunks === 1
        ? 'perplexity-threads.json'
        : 'perplexity-threads-' + chunkNum + '-of-' + totalChunks + '.json';

      var blob = new Blob([JSON.stringify(chunk, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);

      // Use chrome.runtime to trigger download via background script
      chrome.runtime.sendMessage({
        type: 'download',
        url: url,
        filename: filename
      });

      // Small delay between downloads
      await new Promise(function(r) { setTimeout(r, 500); });
    }

    chrome.runtime.sendMessage({ type: 'done', saved: saved, failed: failed });

  } catch (err) {
    chrome.runtime.sendMessage({ type: 'error', message: err.message || 'Export failed' });
  }
}
