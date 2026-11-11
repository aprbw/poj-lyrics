#!/usr/bin/env node
/**
 * Sounds of Joy — Markdown + YAML Songbook Compiler
 * Scans songs/*.md, validates YAML headers + sections, and generates:
 *   1. songs/manifest.json (for dynamic HTTP fetch)
 *   2. js/songs-bundle.js  (pre-bundled fallback so the site works offline & instantaneously)
 *
 * Automatically executed on Vercel deploy ("npm run build") whenever songs/*.md are updated on GitHub.
 */
const fs = require('fs');
const path = require('path');
const SOJMarkdown = require('../js/md-parser.js');

const ROOT_DIR = path.resolve(__dirname, '..');
const SONGS_DIR = path.join(ROOT_DIR, 'songs');
const MANIFEST_PATH = path.join(SONGS_DIR, 'manifest.json');
const BUNDLE_PATH = path.join(ROOT_DIR, 'js', 'songs-bundle.js');

const mdFiles = fs.readdirSync(SONGS_DIR)
  .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
  .sort();

const entries = [];
const manifestItems = [];

for (const filename of mdFiles) {
  const relPath = 'songs/' + filename;
  const fullPath = path.join(SONGS_DIR, filename);
  const raw = fs.readFileSync(fullPath, 'utf8');
  const parsed = SOJMarkdown.parseSongMarkdown(raw, relPath);

  if (!parsed.id || !parsed.title || !parsed.year) {
    throw new Error(`Invalid YAML frontmatter in ${relPath}: missing id, title, or year`);
  }

  entries.push({ id: parsed.id, file: relPath, raw });
  manifestItems.push({
    id: parsed.id,
    title: parsed.title,
    year: parsed.year,
    file: relPath
  });
}

fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), count: manifestItems.length, songs: manifestItems }, null, 2) + '\n', 'utf8');

const bundleJs =
  '/**\n' +
  ' * Auto-generated from songs/*.md by scripts/build-songbook.js\n' +
  ' * Edit individual Markdown + YAML files inside songs/ and run `node scripts/build-songbook.js`.\n' +
  ' */\n' +
  'window.SOJ_MD_SONGS = ' + JSON.stringify(entries, null, 2) + ';\n';

fs.writeFileSync(BUNDLE_PATH, bundleJs, 'utf8');
console.log(`Built Sounds of Joy songbook: ${entries.length} Markdown (.md) songs -> songs/manifest.json & js/songs-bundle.js`);
