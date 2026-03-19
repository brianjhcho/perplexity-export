#!/usr/bin/env node
/**
 * perplexity-export CLI
 *
 * Exports all your Perplexity AI threads to JSON files.
 *
 * Usage:
 *   npx perplexity-export
 *   npx perplexity-export --output ./my-threads
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const outputIdx = args.indexOf('--output');
const OUTPUT_DIR = outputIdx !== -1 && args[outputIdx + 1]
  ? path.resolve(args[outputIdx + 1])
  : path.resolve('./perplexity-threads');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const PORT = 9876;
let received = 0;

// ── Receiver server ──────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.perplexity.ai');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'POST' && req.url === '/thread') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const thread = JSON.parse(body);
        received++;
        const name = (thread.slug || thread.title || `thread-${received}`)
          .slice(0, 80).replace(/[^a-zA-Z0-9._-]/g, '_');
        fs.writeFileSync(path.join(OUTPUT_DIR, `${name}.json`), JSON.stringify(thread, null, 2));
        if (received % 50 === 0) console.log(`  ${received} threads saved`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, count: received }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/done') {
    console.log(`\n  Done! ${received} threads exported to ${OUTPUT_DIR}\n`);
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, total: received }));
    setTimeout(() => process.exit(0), 500);
    return;
  }

  res.writeHead(404);
  res.end();
});

// ── Browser script ───────────────────────────────────────────────────────────

const browserScript = fs.readFileSync(new URL('./browser.js', import.meta.url), 'utf8');

// ── Main ─────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`
  ┌─────────────────────────────────────────────────────┐
  │                                                     │
  │   perplexity-export                                 │
  │                                                     │
  │   1. Open Chrome to perplexity.ai (any page)        │
  │   2. Press Cmd+Option+J to open the console         │
  │   3. Paste the script below and press Enter         │
  │                                                     │
  │   Saving to: ${OUTPUT_DIR.padEnd(35)}│
  │                                                     │
  └─────────────────────────────────────────────────────┘
  `);

  // Copy to clipboard if pbcopy is available
  try {
    execSync('echo ' + JSON.stringify(browserScript) + ' | pbcopy', { stdio: 'pipe' });
    console.log('  Script copied to clipboard! Just Cmd+V in the console.\n');
  } catch {
    console.log('  Script:\n');
    console.log(browserScript);
    console.log('\n  Copy the script above and paste it in the browser console.\n');
  }

  console.log('  Waiting for threads...\n');
});
