# Repository Documentation — Sounds of Joy (`poj-lyrics`)

> Looking for the song list, lyrics, chords, and recordings? See **[`README.md`](./README.md)** (compact song index) or **[`DIRECTORY.md`](./DIRECTORY.md)** (full metadata table).

This document covers the technical architecture, file structure, Markdown + YAML song format, local build pipeline, and static deployment setup for the **[Place of Joy (POJ)](https://placeofjoy.org.au/)** Melbourne Original Songbook repository (`aprbw/poj-lyrics`).

---

## Repository Structure

```text
poj-lyrics/
├── README.md                   # Compact POJ Song Index (Year, Song, Camp/Release)
├── DIRECTORY.md                # Full Song Directory Table (keys, credits, audio & sources)
├── DOCS.md                     # Technical & repository documentation (this file)
├── songs/                      # 16 archived POJ song files (.md with YAML frontmatter)
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
│   ├── 2021-sesuai-dengan-rencana-mu.md
│   ├── 2021-uno.md
│   ├── 2023-made-worthy.md
│   ├── 2024-my-declaration.md
│   ├── 2025-within.md
│   ├── 2026-rooted.md
│   └── manifest.json           # Auto-generated song index
├── audio/                      # Local-only MP3/M4A recordings (gitignored; not pushed to GitHub)
├── video/                      # Local-only 1080p MP4 YouTube upload renders (gitignored; not pushed to GitHub)
├── css/
│   └── styles.css              # Spreadsheet grid, pivot table, chord-over-lyric, focus mode & print styles
├── js/
│   ├── md-parser.js            # Universal YAML frontmatter + Markdown ChordPro parser (Node & browser)
│   ├── songs-bundle.js         # Auto-generated pre-compiled song bundle (offline & instant load)
│   ├── transposer.js           # Chromatic 12-key, Capo, Nashville (1–7) & Proclaim plain-text exporter
│   └── app.js                  # Interactive table/pivot UI, song sheet, Focus Mode, YouTube & local audio
├── scripts/
│   └── build-songbook.js       # Compiles songs/*.md -> songs/manifest.json & js/songs-bundle.js
├── index.html                  # Single-page static web application (works offline or hosted)
├── package.json                # Zero-dependency Node build script ("npm run build")
└── vercel.json                 # Pre-configured static hosting build config (for future Vercel deploy)
```

---

## Architecture Overview

1. **Single Source of Truth (`songs/*.md`):** Every song lives as a human-readable Markdown file with YAML frontmatter inside `songs/`.
2. **Zero-Dependency Compiler (`scripts/build-songbook.js`):** Scans `songs/*.md` using `js/md-parser.js`, validates required frontmatter (`id`, `title`, `year`), and outputs:
   - `songs/manifest.json` — lightweight JSON index for dynamic HTTP fetching.
   - `js/songs-bundle.js` — pre-bundled `window.SOJ_MD_SONGS` payload so `index.html` loads instantaneously and works offline (even when opened directly via `file://`).
3. **Interactive Directory, Song View & Focus Mode (`js/transposer.js`, `js/app.js`):**
   - **Browse Songs (`#/`):** Excel-style interactive song table with multi-select column AutoFilters, ascending/descending column sorting, row grouping, column visibility controls, and a 2D **Pivot Table** (`Rows × Columns`, counts or song titles with click-to-drill-down).
   - **Song Page (`#/song/<id>`):** Places **Chords & Lyrics immediately beneath the song title**, with Transpose/Notation (`Chords`, `Nashville 1–7`, `Lyrics Only`, `Capo`), **Copy Plain Lyrics (Proclaim)** export, **Recordings** (YouTube links + local `<audio>` when running locally; Google Drive links are kept strictly in GitHub Markdown files), and **Credits & Song Details** positioned at the bottom.
   - **Focus Mode / Raw View:** Distraction-free mobile and desktop view showing just **Title + Lyrics** with an optional **Chords: Off / On** toggle and font sizing.
   - **Contact (`#/contact`):** Single dedicated page displaying maintainer contact details.

---

## Song Markdown + YAML Format (`songs/*.md`)

File naming convention: `songs/<YEAR>-<id>.md` (for example, `songs/2026-rooted.md`).

### YAML Frontmatter Fields

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `id` | `string` | Yes | Unique URL-safe slug (e.g. `"rooted"`). |
| `title` | `string` | Yes | Primary song title. |
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

- **Section headers:** Start each section with `## <Section Name>` (e.g. `## Intro`, `## Verse 1`, `## Pre-Chorus`, `## Chorus`, `## Bridge`, `## Outro`). Sections named `Intro`, `Interlude`, or `Instrumental` — as well as chord-only `Outro` sections without sung words — are automatically marked instrumental (or override explicitly with `> Instrumental: true`).
- **Section key modulations:** Append `(+N)` or `(-N)` semitones to a section header (e.g. `## Final Chorus (+2)` or `## Outro (+2)` in `songs/2014-let-go-let-god.md`) when a song modulates mid-arrangement; `js/transposer.js` and `js/app.js` shift that section's target key automatically in all 12 keys and Capo positions while keeping Nashville degrees (`1–7`) relative to the modulated key.
- **Chord progressions:** Add an optional blockquote directly beneath a section header:
  ```markdown
  > Progression: 1  |  5/7  |  6m7  |  4
  ```
- **Inline chords:** Place either **Nashville numbers** (`[1]`, `[2m7]`, `[1/3]`, `[4]`, `[5]`, `[6m7]`, `[6M]`) or **letter chords** (`[Eb]`, `[Cm7]`, `[Bb/D]`) inline immediately before the syllable where the chord changes.
- **Line breaks:** End each lyric line (except the last line of a stanza) with **two trailing spaces** (`  `) — standard Markdown hard line breaks — so stanzas render line-by-line on GitHub as well as in the web songbook. Use a blank line to separate sub-stanzas.

### Example Song File

```markdown
---
id: "rooted"
title: "Rooted"
year: 2026
camp: "CCM26: Rooted"
language: "English"
scripture: "Ephesians 3:17–19"
credits: "Lyrics & Music: Alicia Jeanelly, Farrel Sihite, Tiffany Lindsay, Rachel \"Rere\" Halim"
lyricists: "Alicia Jeanelly, Farrel Sihite, Tiffany Lindsay, Rachel \"Rere\" Halim"
composers: "Alicia Jeanelly, Farrel Sihite, Tiffany Lindsay, Rachel \"Rere\" Halim"
performers: "POJ Praise & Worship"
credit_note: "Verified in CCM26 Rooted Lyrics Doc."
key: "Eb"
key_verified: true
key_note: "Concert Key Eb major on CCM26 Live Multitrack & Congregation recordings; also performed in D major in live worship set"
chord_status: "chords-archived"
youtube_url: ""
contact: "arian.prabowo@placeofjoy.org.au"
audio_files:
  - label: "Rooted — CCM26 Congregation Mix, Key Eb (M4A)"
    path: "audio/Rooted Congression.m4a"
    drive_url: "https://drive.google.com/file/d/1fGgBaFQJWAWTTiSrAoRZolJZiJPoavCE/view?usp=drivesdk"
drive_links:
  - label: "CCM26 Rooted Lyrics Doc"
    url: "https://docs.google.com/document/d/1UZ1ZenVJLwZ9TKamYHStz7Xw7QFixWk9zKlmXZcLutI/edit"
---

## Verse 1
> Progression: 1  |  5/7  |  6m7  |  6m7/5  ||  4  |  1/3  |  2m7  |  5

Through the [1]winter, through the [5/7]rain  
Through the [6m7]joy and through the [6m7/5]pain  
Storms may [4]come and shake my [1/3]ground  
Rooted [2m7]deep, my hope is [5]found
```

---

## Local Development & Building

No external `npm` packages are required — only **Node.js** (v16+):

```bash
# Rebuild songs/manifest.json and js/songs-bundle.js after editing songs/*.md
npm run build

# Preview index.html locally with any static server (or open index.html directly)
npx serve .
```

---

## Local Media Policy (`audio/` & `video/`)

- Both local `audio/` and `video/` directories are listed in [`.gitignore`](./.gitignore) and **never pushed to GitHub**.
- On the website (`index.html`), external recording links point strictly to **YouTube** (`youtube_url`); Google Drive links (`drive_url` / `drive_links`) are kept solely inside the GitHub Markdown files (`songs/*.md` and `DIRECTORY.md`). When running locally with `audio/` present on disk, `index.html` also detects and plays local audio files referenced via `path`.
- `video/` stores local 1080p `.mp4` renders prepared for YouTube upload from unique local audio versions not yet on YouTube.

---

## Live Deployment (Vercel)

The web songbook (`index.html`) is deployed live at **[sounds-of-joy.vercel.app](https://sounds-of-joy.vercel.app/)**:

1. Push updates to the `main` branch on GitHub (`https://github.com/aprbw/poj-lyrics`).
2. `vercel.json` automatically runs `node scripts/build-songbook.js` on every push so edits made directly to `songs/*.md` on GitHub compile automatically on deploy.

---

## Copyright

© All rights reserved by the respective songwriters, lyricists, composers, and copyright holders.
