# perplexity-export

Export all your Perplexity AI threads to JSON with one command.

No extensions. No API keys. No sign-up. Just your browser and a terminal.

## Usage

```bash
npx perplexity-export
```

This will:
1. Start a local receiver and copy a script to your clipboard
2. Open Chrome to `perplexity.ai`, press `Cmd+Option+J`, paste, Enter
3. Watch your threads export in real-time

Files are saved to `./perplexity-threads/` as individual JSON files.

### Options

```bash
npx perplexity-export --output ./my-backup
```

## How it works

1. A tiny local server starts on `localhost:9876`
2. A browser script scrolls your Perplexity library to discover all threads
3. Each thread is fetched via Perplexity's internal API (from your browser session)
4. Results are sent to the local server which saves them as JSON files
5. No data leaves your machine. No credentials are stored.

## Output format

Each thread is saved as a JSON file:

```json
{
  "title": "Thread title",
  "slug": "thread-slug-abc123",
  "source": "perplexity",
  "url": "https://www.perplexity.ai/search/thread-slug-abc123",
  "exported_at": "2026-03-19T...",
  "chat_messages": [
    { "sender": "human", "text": "Your question", "created_at": "..." },
    { "sender": "assistant", "text": "Perplexity's answer", "created_at": "..." }
  ]
}
```

## Why this exists

Perplexity doesn't offer a bulk data export. This tool fills that gap so you can:
- Back up your research history
- Import threads into other tools (Obsidian, Notion, custom pipelines)
- Own your data

## License

MIT
