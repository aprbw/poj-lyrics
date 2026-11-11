# Sounds of Joy — POJ Original Songbook (`soundsofjoy.vercel.app`)

Official digital archive of original worship & Easter Camp (CCM) songs written by the **Place of Joy (POJ)** Melbourne community (2013–2026), featuring **Markdown + YAML song sheets**, **12-key & Nashville chord transposition**, **search/filter/sort browsing**, and **bundled audio recordings**.

## Contact & Archive Maintainer
For any issues, corrections, or contributions regarding **lyrics, chords, songwriter/composer attributions, external links, audio recordings, or camp details**, please contact:
- **Arian Prabowo** — [arian.prabowo@placeofjoy.org.au](mailto:arian.prabowo@placeofjoy.org.au)

---

## Repository Structure

```text
sounds-of-joy/
├── songs/                      # 17 individual POJ song files (.md with YAML frontmatter)
│   ├── 2013-who-is-he.md
│   ├── 2013-be-one.md
│   ├── 2014-let-go-let-god.md
│   ├── 2015-jesus-not-the-crowd.md
│   ├── 2015-kusadari.md
│   ├── 2016-painter.md
│   ├── 2018-i-am-free.md
│   ├── 2018-a-song-for-you.md
│   ├── 2018-how-i-love-you-lord.md
│   ├── 2019-cerminan-mu.md
│   ├── 2019-embraced.md
│   ├── 2020-sesuai-dengan-rencanamu.md
│   ├── 2021-uno.md
│   ├── 2023-here-is-my-broken-heart.md
│   ├── 2024-my-declaration.md
│   ├── 2025-within.md
│   ├── 2026-rooted.md
│   └── manifest.json           # Auto-generated index of songs/*.md
├── audio/                      # 9 bundled POJ original song MP3/M4A recordings
├── css/
│   └── styles.css              # Chord-over-lyric alignment, stage dark mode & print layout
├── js/
│   ├── md-parser.js            # Universal YAML frontmatter + Markdown ChordPro parser
│   ├── songs-bundle.js         # Pre-compiled bundle from songs/*.md (offline & instant load)
│   ├── transposer.js           # Chromatic 12-key, Capo & Nashville 1–7 transposer
│   └── app.js                  # Browse, Sort By, Audio Player, Setlist & Live .md Editor
├── scripts/
│   └── build-songbook.js       # Compiles songs/*.md -> songs/manifest.json & js/songs-bundle.js
├── index.html
├── package.json
└── vercel.json
```

---

## Songbook Markdown + YAML Format (`songs/*.md`)

Every song is a standalone `.md` file inside `songs/` with a YAML header:

```markdown
---
id: "rooted"
title: "Rooted"
alt_title: "Rooted Deep, My Hope is Found"
year: 2026
camp: "CCM26: Rooted"
language: "English"
scripture: "Ephesians 3:17–19"
credits: "Lyrics & Music: Alicia Jeanelly, Farrel Sihite, Tiffany Lindsay, Rachel "Rere" Halim"
lyricists: "Alicia Jeanelly, Farrel Sihite, Tiffany Lindsay, Rachel "Rere" Halim"
composers: "Alicia Jeanelly, Farrel Sihite, Tiffany Lindsay, Rachel "Rere" Halim"
performers: "POJ Praise & Worship"
key: "G"
key_verified: false
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

Whenever you add or edit a `.md` file in `songs/` on GitHub, Vercel automatically runs `node scripts/build-songbook.js` on deploy (or run `npm run build` locally).

---

## Deploying to GitHub & `soundsofjoy.vercel.app`

1. Create a repository named `sounds-of-joy` in your GitHub account and push this unzipped directory:
   ```bash
   git init
   git add .
   git commit -m "Sounds of Joy: Markdown + YAML songbook, credits & audio archive"
   git branch -M main
   git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/sounds-of-joy.git
   git push -u origin main
   ```
2. Import the repo at [vercel.com/new](https://vercel.com/new) and set **Project Name** to `soundsofjoy`.
3. Click **Deploy** — `vercel.json` automatically runs `node scripts/build-songbook.js` and publishes to `https://soundsofjoy.vercel.app`.
