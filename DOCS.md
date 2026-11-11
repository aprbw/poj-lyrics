# Repository Documentation — Sounds of Joy (`poj-lyrics`)

> Looking for the song list, lyrics, chords, and recordings? See the **[Song Directory (`README.md`)](./README.md)**.

This document covers the technical architecture, file structure, Markdown + YAML song format, build pipeline, and deployment setup for the **Place of Joy (POJ) Melbourne Original Songbook** (`soundsofjoy.vercel.app`).

---

## Repository Structure

```text
poj-lyrics/
├── README.md                   # Master POJ Song Directory (2013–2026)
├── DOCS.md                     # Technical & repository documentation (this file)
├── songs/                      # 16 individual POJ song files (.md with YAML frontmatter)
│   ├── 2013-who-is-he.md
│   ├── 2014-let-go-let-god.md
│   ├── 2015-jesus-not-the-crowd.md
│   ├── 2015-kusadari.md
│   ├── 2016-painter.md
│   ├── 2018-a-song-for-you.md
│   ├── 2018-how-i-love-you-lord.md
│   ├── 2018-i-am-free.md
│   ├── 2019-cerminan-mu.md
│   ├── 2019-embraced.md
│   ├── 2020-sesuai-dengan-rencanamu.md
│   ├── 2021-uno.md
│   ├── 2023-here-is-my-broken-heart.md
│   ├── 2024-my-declaration.md
│   ├── 2025-within.md
│   ├── 2026-rooted.md
│   └── manifest.json           # Auto-generated song index
├── audio/                      # 9 bundled MP3/M4A recordings (<10 MB each)
│   └── README.md               # Bundled & Google Drive-linked audio index
├── css/
│   └── styles.css              # Chord-over-lyric layout, stage dark mode & print styles
├── js/
│   ├── md-parser.js            # Universal YAML frontmatter + Markdown ChordPro parser (Node & browser)
│   ├── songs-bundle.js         # Auto-generated pre-compiled song bundle (offline & instant load)
│   ├── transposer.js           # Chromatic 12-key, Capo & Nashville (1–7) transposer
│   └── app.js                  # Search/filter/sort UI, HTML5 audio player, setlist & live .md editor
├── scripts/
│   └── build-songbook.js       # Compiles songs/*.md -> songs/manifest.json & js/songs-bundle.js
├── index.html                  # Single-page static web application
├── package.json                # Zero-dependency Node build script ("npm run build")
└── vercel.json                 # Vercel build & static routing config
```

---

## Architecture Overview

1. **Single Source of Truth (`songs/*.md`):** Every song lives as a human-readable Markdown file with YAML frontmatter inside `songs/`.
2. **Zero-Dependency Compiler (`scripts/build-songbook.js`):** Scans `songs/*.md` using `js/md-parser.js`, validates required frontmatter (`id`, `title`, `year`), and outputs:
   - `songs/manifest.json` — lightweight JSON index for dynamic HTTP fetching.
   - `js/songs-bundle.js` — pre-bundled `window.SOJ_MD_SONGS` payload so `index.html` loads instantaneously and works offline (even when opened directly via `file://`).
3. **Client Transposition & Stage View (`js/transposer.js`, `js/app.js`):** Parses inline bracketed chords (`[G]`, `[D/F#]`) or Nashville numbers (`[1]`, `[6m]`, `[1/3]`) and renders interactive 12-key, Capo, and Nashville charts alongside bundled `<audio>` playback, YouTube embeds, setlist building, and print layouts.

---

## Song Markdown + YAML Format (`songs/*.md`)

File naming convention: `songs/<YEAR>-<id>.md` (for example, `songs/2026-rooted.md`).

### YAML Frontmatter Fields

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `id` | `string` | Yes | Unique URL-safe slug (e.g. `"rooted"`). |
| `title` | `string` | Yes | Primary song title. |
| `alt_title` | `string` | No | Alternate title or subtitle (`""` if none). |
| `year` | `integer` | Yes | Release or Easter Camp (CCM) year (e.g. `2026`). |
| `camp` | `string` | No | Camp theme or release label (e.g. `"CCM26: Rooted"`). |
| `language` | `string` | No | `"English"`, `"Indonesian"`, or `"Bilingual"`. |
| `scripture` | `string` | No | Theme scripture reference(s). |
| `credits` | `string` | No | Combined display attribution line. |
| `lyricists` | `string` | No | Lyricist attribution(s). |
| `composers` | `string` | No | Composer attribution(s). |
| `performers` | `string` | No | Recorded/camp worship team credits. |
| `credit_note` | `string` | No | Provenance note for archival verification. |
| `key` | `string` | No | Base musical key (e.g. `"G"`, `"C"`, `"D"`, `"E"`). Defaults to `"G"`. |
| `key_verified` | `boolean` | No | `true` if original key is verified from archival charts/schedules. |
| `key_note` | `string` | No | Key/modulation notes (e.g. `"Original Key G modulating to A"`). |
| `chord_status` | `string` | No | `"chords-archived"`, `"key-archived"`, `"lyrics-archived"`, or `"audio-archived"`. |
| `youtube_url` | `string` | No | Official YouTube URL (`""` if none). |
| `contact` | `string` | No | Maintainer email for corrections. |
| `audio_files` | `list` | No | List of `{ label, path, drive_url }` items (`[]` if none). Leave `path: ""` for Drive-only streams. |
| `drive_links` | `list` | No | List of `{ label, url }` source documents (`[]` if none). |

### Markdown Body Syntax

- **Section headers:** Start each section with `## <Section Name>` (e.g. `## Intro`, `## Verse 1`, `## Pre-Chorus`, `## Chorus`, `## Bridge`, `## Outro`). Sections named `Intro`, `Interlude`, `Outro`, or `Instrumental` are automatically marked instrumental (or override explicitly with `> Instrumental: true`).
- **Chord progressions:** Add an optional blockquote directly beneath a section header:
  ```markdown
  > Progression: 1  4  6m  5
  ```
- **Inline chords:** Place either **Nashville numbers** (`[1]`, `[2m]`, `[1/3]`, `[4]`, `[5]`, `[6m]`) or **letter chords** (`[G]`, `[Am7]`, `[D/F#]`) inline immediately before the syllable where the chord changes.
- **Line breaks:** End each lyric line (except the last line of a stanza) with **two trailing spaces** (`  `) — standard Markdown hard line breaks — so stanzas render line-by-line on GitHub as well as in the web songbook. Use a blank line to separate sub-stanzas.

### Example Song File

```markdown
---
id: "rooted"
title: "Rooted"
alt_title: "Rooted Deep, My Hope is Found"
year: 2026
camp: "CCM26: Rooted"
language: "English"
scripture: "Ephesians 3:17–19"
credits: "Lyrics & Music: Alicia Jeanelly, Farrel Sihite, Tiffany Lindsay, Rachel \"Rere\" Halim"
lyricists: "Alicia Jeanelly, Farrel Sihite, Tiffany Lindsay, Rachel \"Rere\" Halim"
composers: "Alicia Jeanelly, Farrel Sihite, Tiffany Lindsay, Rachel \"Rere\" Halim"
performers: "POJ Praise & Worship"
credit_note: "Verified in CCM26 Rooted Lyrics Doc."
key: "G"
key_verified: false
key_note: ""
chord_status: "lyrics-archived"
youtube_url: ""
contact: "arian.prabowo@placeofjoy.org.au"
audio_files:
  - label: "Rooted — Congregation Mix"
    path: ""
    drive_url: "https://drive.google.com/file/d/1fGgBaFQJWAWTTiSrAoRZolJZiJPoavCE/view?usp=drivesdk"
drive_links:
  - label: "CCM26 Rooted Lyrics Doc"
    url: "https://docs.google.com/document/d/1UZ1ZenVJLwZ9TKamYHStz7Xw7QFixWk9zKlmXZcLutI/edit"
---

## Verse 1
> Progression: 1  4  6m  5

[1]Through the winter, [4]through the rain  
[6m]Through the joy and [5]through the pain
```

---

## Local Development & Building

No external `npm` packages are required — only **Node.js** (v16+):

```bash
# Rebuild songs/manifest.json and js/songs-bundle.js after editing songs/*.md
npm run build

# Preview locally with any static server (or open index.html directly)
npx serve .
```

---

## Audio Archive Policy (`audio/`)

- Recordings **under 10 MB** are stored directly in [`audio/`](./audio/README.md) and referenced via `path: "audio/<filename>"` in the song's `audio_files` frontmatter for instant HTML5 `<audio>` playback.
- Master/rehearsal recordings **over 10 MB** are streamed from Google Drive (`path: ""` with `drive_url` populated) to keep the Git repository fast and lightweight. See [`audio/README.md`](./audio/README.md) for the full list.

---

## Deployment (GitHub + Vercel)

1. Push updates to the `main` branch on GitHub (`aprbw/poj-lyrics`).
2. Connect the repository to [Vercel](https://vercel.com/new) (project name: `soundsofjoy`).
3. `vercel.json` automatically runs `node scripts/build-songbook.js` on every push so edits made directly to `songs/*.md` on GitHub compile and deploy automatically to `https://soundsofjoy.vercel.app`.
