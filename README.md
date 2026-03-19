# perplexity-export

Export all your Perplexity AI threads to JSON. One click or one command.

Perplexity doesn't offer a bulk data export. This tool fills that gap.

## Quick Start

### Option A: Chrome Extension (one click)

1. Download this repo or clone it
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** → select the `extension/` folder
5. Navigate to [perplexity.ai](https://www.perplexity.ai)
6. Click the extension icon → **Export All Threads**
7. Files download automatically to your Downloads folder

### Option B: CLI (one command)

```bash
npx perplexity-export
```

1. A local server starts and copies a script to your clipboard
2. Open [perplexity.ai](https://www.perplexity.ai) in Chrome
3. Press `Cmd+Option+J` (Mac) or `F12` (Windows) to open the console
4. Paste and press Enter
5. Threads are saved to `./perplexity-threads/`

```bash
# Custom output directory
npx perplexity-export --output ./my-backup
```

## How It Works

### The Problem

Perplexity AI has no bulk export feature. Your research threads — potentially thousands of conversations — are locked inside the platform with no way to download them.

### The Solution

This tool uses Perplexity's internal REST API to fetch your threads directly. It runs entirely in your browser using your existing login session. No API keys, no credentials, no third-party servers.

```
┌──────────────────────────────────────────────────┐
│                  Your Browser                    │
│                                                  │
│  1. Discover threads                             │
│     ├─ POST /rest/thread/list_ask_threads        │
│     │  (paginated, gets ~600 "ask" threads)      │
│     └─ Scroll library DOM                        │
│        (catches Pro, Research, and other types)   │
│                                                  │
│  2. Fetch each thread                            │
│     GET /rest/thread/{slug}                      │
│     (10 parallel requests, ~200ms between batches)│
│                                                  │
│  3. Save                                         │
│     Extension: chrome.downloads API → Downloads/  │
│     CLI: local server on :9876 → disk             │
│                                                  │
└──────────────────────────────────────────────────┘
```

All requests happen from your browser tab with your session cookies. No data leaves your machine.

### Why Two Discovery Methods?

Perplexity's `list_ask_threads` API only returns regular search threads (~600 in testing). But the library page renders all thread types — Pro searches, Deep Research, collections — via virtualized infinite scroll. Combining both methods ensures maximum coverage.

## Output Format

Each thread is saved as a JSON file:

```json
{
  "title": "What opportunities exist in East African agritech?",
  "slug": "what-opportunities-exist-in-eas-abc123",
  "source": "perplexity",
  "url": "https://www.perplexity.ai/search/what-opportunities-exist-in-eas-abc123",
  "exported_at": "2026-03-19T18:30:00.000Z",
  "chat_messages": [
    {
      "sender": "human",
      "text": "What opportunities exist in East African agritech?",
      "created_at": "2026-03-15T10:00:00.000Z"
    },
    {
      "sender": "assistant",
      "text": "East African agritech has seen significant growth...",
      "created_at": "2026-03-15T10:00:05.000Z"
    }
  ]
}
```

The format is compatible with common AI conversation importers and knowledge management tools.

## What You Can Do With Your Export

- **Back up your research** — keep a local copy of everything you've ever searched
- **Import into Obsidian/Notion** — convert JSON to markdown for your knowledge base
- **Feed into AI pipelines** — use your Perplexity research as context for Claude, ChatGPT, or custom tools
- **Search locally** — grep through your threads without an internet connection
- **Migrate** — if you switch platforms, your research history comes with you

## FAQ

**How long does it take?**
~3-5 minutes for 600 threads. The scroll phase takes 1-2 minutes, fetching takes 2-3 minutes.

**Will this get my account banned?**
The tool uses the same API calls your browser makes when you browse Perplexity normally. It adds small delays between requests to be respectful. That said, use at your own risk.

**Why not just use the Perplexity API?**
Perplexity's public API is for making new queries, not reading back your conversation history. There is no official endpoint for bulk export.

**Does this work with a free account?**
Yes. The export uses your browser session regardless of subscription tier.

**What about threads in Spaces/Collections?**
The scroll method discovers threads across all sections of the library, including Spaces. The list API only covers regular search threads.

**The export missed some threads. Why?**
If the library scroll stops too early, some threads may not load. Re-run the export — already-downloaded threads won't be duplicated.

## Privacy & Security

- Runs entirely in your browser and on your local machine
- No data is sent to any third-party server
- No API keys or credentials are collected or stored
- The CLI's local server only accepts connections from `perplexity.ai` (CORS restricted)
- Session cookies are never logged, stored, or transmitted

## Development

```
perplexity-export/
├── cli.js              # npx entry point — starts receiver + copies browser script
├── receiver.js         # Local HTTP server that saves threads to disk
├── browser.js          # Minified browser console script
├── package.json
├── README.md
└── extension/
    ├── manifest.json   # Chrome extension manifest v3
    ├── popup.html      # Extension popup UI
    ├── popup.js        # Popup logic — sends export command, shows progress
    ├── content.js      # Content script — scrolls, fetches, extracts
    ├── background.js   # Service worker — handles downloads
    └── icons/          # Extension icons
```

### Building from source

No build step required. The extension and CLI are plain JavaScript.

```bash
# Test the CLI locally
node cli.js

# Load the extension
# chrome://extensions → Developer mode → Load unpacked → select extension/
```

### Contributing

Issues and PRs welcome. The main areas for improvement:

- [ ] Publish to Chrome Web Store
- [ ] Firefox extension (Manifest v3 compatible)
- [ ] Export to Markdown format (in addition to JSON)
- [ ] Resume interrupted exports
- [ ] Deep Research thread pagination (some threads have >50 entries)

## License

MIT

## Author

[Brian Cho](https://github.com/brianjhcho)
