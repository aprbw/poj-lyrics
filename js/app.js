/**
 * Sounds of Joy — Interactive Song Directory (Spreadsheet + Pivot) & Worship Reader
 * Place of Joy (POJ) Melbourne — https://placeofjoy.org.au/
 */

(function () {
  var MDParser = window.SOJMarkdown;
  var Transposer = window.SOJTransposer;
  var CONTACT_EMAIL = 'arian.prabowo@placeofjoy.org.au';

  var MISSING_CCM22_SONGS = [
    {
      id: 'missing-my-faith',
      isMissing: true,
      title: 'My Faith',
      year: 2022,
      camp: 'CCM22: Little Things',
      language: '—',
      scripture: '',
      credits: 'Missing — CCM22: Little Things',
      lyricists: '',
      composers: '',
      performers: '',
      baseKey: '',
      keyVerified: false,
      keyNote: '',
      chordStatus: 'missing',
      youtubeUrl: '',
      audioFiles: [],
      sections: []
    },
    {
      id: 'missing-all-you-want',
      isMissing: true,
      title: 'All You Want',
      year: 2022,
      camp: 'CCM22: Little Things',
      language: '—',
      scripture: '',
      credits: 'Missing — CCM22: Little Things',
      lyricists: '',
      composers: '',
      performers: '',
      baseKey: '',
      keyVerified: false,
      keyNote: '',
      chordStatus: 'missing',
      youtubeUrl: '',
      audioFiles: [],
      sections: []
    },
    {
      id: 'missing-little-things',
      isMissing: true,
      title: 'Little Things',
      year: 2022,
      camp: 'CCM22: Little Things',
      language: '—',
      scripture: '',
      credits: 'Missing — CCM22: Little Things',
      lyricists: '',
      composers: '',
      performers: '',
      baseKey: '',
      keyVerified: false,
      keyNote: '',
      chordStatus: 'missing',
      youtubeUrl: '',
      audioFiles: [],
      sections: []
    }
  ];

  function loadInitialSongs() {
    var rawBundle = window.SOJ_MD_SONGS || [];
    var parsed = [];
    for (var i = 0; i < rawBundle.length; i++) {
      var entry = rawBundle[i];
      parsed.push(MDParser.parseSongMarkdown(entry.raw, entry.file));
    }
    return parsed;
  }

  var SONGS = loadInitialSongs();

  var STORAGE_KEYS = {
    theme: 'soj_theme_v2',
    visibleCols: 'soj_visible_cols_v2',
    presentationSync: 'soj_presentation_sync_v1',
    presentationPing: 'soj_presentation_ping_v1'
  };

  function safeLoad(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function safeSave(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // Ignore storage quota or private-mode restrictions
    }
  }

  var COLUMNS = [
    { key: 'year',      label: 'Year',                  filterable: true,  sortable: true, defaultVisible: true },
    { key: 'title',     label: 'Song',                  filterable: false, sortable: true, defaultVisible: true, locked: true },
    { key: 'camp',      label: 'Camp / Release',        filterable: true,  sortable: true, defaultVisible: true },
    { key: 'key',       label: 'Key',                   filterable: true,  sortable: true, defaultVisible: false },
    { key: 'status',    label: 'Status',                filterable: true,  sortable: true, defaultVisible: false },
    { key: 'language',  label: 'Language',              filterable: true,  sortable: true, defaultVisible: false },
    { key: 'credits',   label: 'Songwriters / Credits', filterable: true,  sortable: true, defaultVisible: false },
    { key: 'scripture', label: 'Scripture',             filterable: true,  sortable: true, defaultVisible: false },
    { key: 'youtube',   label: 'YouTube',               filterable: true,  sortable: true, defaultVisible: false }
  ];

  function getDefaultVisibleCols() {
    var map = {};
    for (var i = 0; i < COLUMNS.length; i++) {
      map[COLUMNS[i].key] = COLUMNS[i].defaultVisible;
    }
    return map;
  }

  var state = {
    activeView: 'browse',       // 'browse' | 'song' | 'contact'
    selectedSongId: 'rooted',
    searchQuery: '',
    sortCol: 'year',
    sortDir: 'desc',            // 'asc' | 'desc'
    colFilters: {},             // colKey -> array of allowed string values (undefined/empty = all)
    openFilterCol: null,
    filterSearchText: '',
    visibleCols: safeLoad(STORAGE_KEYS.visibleCols, getDefaultVisibleCols()),
    showMissing: false,
    transposeMap: {},           // songId -> semitones (-11..11)
    capoMap: {},                // songId -> fret (0..7)
    accidentalPref: 'auto',
    notationMode: 'chords',     // 'chords' | 'nashville' | 'lyrics'
    fontScale: 1.0,
    twoColumn: false,
    autoScrollSpeed: 0,
    focusMode: false,
    focusShowChords: false,
    focusColAuto: true,         // default: auto-adjust desktop columns from line width & screen width
    focusManualCols: 2,
    slideshowActive: false,     // 1-window PowerPoint-style Slide Show
    presenterActive: false,     // 2-window Presenter Control (Control + Display)
    slideIndex: 0,
    slideBlackout: false,
    slideFontScale: 1.0,
    displayConnected: false,
    proclaimIncludeHeaders: true,
    theme: safeLoad(STORAGE_KEYS.theme, 'light')
  };

  // Ensure locked columns stay visible
  state.visibleCols.title = true;

  var autoScrollTimer = null;
  var toastTimeout = null;
  var presenterDisplayWin = null;
  var presenterMonitorTimer = null;
  var displayHintTimer = null;
  var presentationChannel = null;
  try {
    if (typeof window.BroadcastChannel === 'function') {
      presentationChannel = new window.BroadcastChannel('soj_presentation_v1');
    }
  } catch (e) {
    presentationChannel = null;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getBaseSongById(id) {
    for (var i = 0; i < SONGS.length; i++) {
      if (SONGS[i].id === id) return SONGS[i];
    }
    return SONGS[0] || null;
  }

  function hasSongChords(song) {
    if (!song || song.isMissing) return false;
    if (song.chordStatus === 'chords-archived') return true;
    var secs = song.sections || [];
    for (var s = 0; s < secs.length; s++) {
      if (secs[s].progression) return true;
      var lines = secs[s].lines || [];
      for (var l = 0; l < lines.length; l++) {
        if (lines[l].indexOf('[') !== -1) return true;
      }
    }
    return false;
  }

  function getDisplayKeyLabel(song) {
    if (!song || song.isMissing || !song.baseKey) return '—';
    var note = song.keyNote || '';
    var modMatch = /modulat(?:es|ing)\s+to\s+([A-G][#b]?)/i.exec(note);
    if (modMatch) {
      return song.baseKey + ' → ' + modMatch[1];
    }
    if (song.sections) {
      for (var i = 0; i < song.sections.length; i++) {
        var delta = Transposer.getSectionModulation(song.sections[i].label);
        if (delta !== 0) {
          var bIdx = Transposer.noteNameToIndex(song.baseKey);
          var mIdx = Transposer.mod12(bIdx + delta);
          var mName = Transposer.indexToNoteName(mIdx, Transposer.shouldUseFlats(mIdx, 'auto'));
          return song.baseKey + ' → ' + mName;
        }
      }
    }
    return song.baseKey;
  }

  function getStatusLabel(song) {
    if (song.isMissing || song.chordStatus === 'missing') return 'Missing';
    if (hasSongChords(song)) return 'Chords';
    if (song.chordStatus === 'key-archived') return 'Key + Lyrics';
    if (song.chordStatus === 'audio-archived') return 'Audio Only';
    return 'Lyrics';
  }

  function getYoutubeStatusLabel(song) {
    return song.youtubeUrl ? 'On YouTube' : 'Not on YouTube';
  }

  function extractSongwriters(song) {
    if (song.isMissing) return ['Missing (CCM22)'];
    var rawParts = [];
    if (song.lyricists) rawParts.push(song.lyricists);
    if (song.composers && song.composers !== song.lyricists) rawParts.push(song.composers);
    if (!rawParts.length && song.credits) {
      rawParts.push(song.credits.replace(/^Lyrics\s*(&\s*Music)?\s*:\s*/i, '').replace(/•\s*Music\s*:\s*/gi, ', '));
    }
    var joined = rawParts.join(', ');
    var tokens = joined.split(/,|&|•|;/);
    var cleaned = [];
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i]
        .replace(/\(.*?\)/g, '')
        .replace(/^Lyrics\s*:\s*/i, '')
        .replace(/^Music\s*:\s*/i, '')
        .trim();
      if (!t) continue;
      if (cleaned.indexOf(t) === -1) cleaned.push(t);
    }
    return cleaned.length ? cleaned : ['Sounds of Joy (POJ)'];
  }

  function getCreditSummaryText(song) {
    if (song.isMissing) return '—';
    var text = song.credits || song.writers || '';
    return text.replace(/^Lyrics\s*&\s*Music\s*:\s*/i, '').trim() || 'Sounds of Joy';
  }

  function getDimensionValues(song, dim) {
    if (dim === 'year') return [String(song.year)];
    if (dim === 'camp') return [song.camp || '—'];
    if (dim === 'key') return [song.isMissing ? '—' : (song.baseKey || '—')];
    if (dim === 'status') return [getStatusLabel(song)];
    if (dim === 'language') return [song.language || '—'];
    if (dim === 'credits' || dim === 'songwriter') return extractSongwriters(song);
    if (dim === 'scripture') return [song.scripture || '—'];
    if (dim === 'youtube') return [getYoutubeStatusLabel(song)];
    return [song.title];
  }

  function getCatalogDataset() {
    if (!state.showMissing) return SONGS.slice();
    return SONGS.concat(MISSING_CCM22_SONGS);
  }

  function matchesSearch(song, q) {
    if (!q) return true;
    var hay = [
      song.title,
      song.camp || '',
      String(song.year),
      getDisplayKeyLabel(song),
      getStatusLabel(song),
      song.language || '',
      song.credits || '',
      song.lyricists || '',
      song.composers || '',
      song.performers || '',
      song.scripture || ''
    ].join(' ').toLowerCase();

    if (hay.indexOf(q) !== -1) return true;

    var secs = song.sections || [];
    for (var s = 0; s < secs.length; s++) {
      var lines = secs[s].lines || [];
      for (var l = 0; l < lines.length; l++) {
        var clean = lines[l].replace(/\[[^\]]+\]/g, '').toLowerCase();
        if (clean.indexOf(q) !== -1) return true;
      }
    }
    return false;
  }

  function matchesColumnFilters(song, ignoreColKey) {
    for (var colKey in state.colFilters) {
      if (!Object.prototype.hasOwnProperty.call(state.colFilters, colKey)) continue;
      if (colKey === ignoreColKey) continue;
      var allowed = state.colFilters[colKey];
      if (!allowed || !allowed.length) continue;
      var vals = getDimensionValues(song, colKey);
      var hit = false;
      for (var i = 0; i < vals.length; i++) {
        if (allowed.indexOf(vals[i]) !== -1) {
          hit = true;
          break;
        }
      }
      if (!hit) return false;
    }
    return true;
  }

  function compareSongs(a, b) {
    var dir = state.sortDir === 'asc' ? 1 : -1;
    var col = state.sortCol;
    var cmp = 0;

    if (col === 'year') {
      cmp = (a.year || 0) - (b.year || 0);
    } else if (col === 'title') {
      cmp = a.title.localeCompare(b.title);
    } else if (col === 'camp') {
      cmp = (a.camp || '').localeCompare(b.camp || '');
    } else if (col === 'key') {
      var ka = a.isMissing ? 99 : Transposer.noteNameToIndex(a.baseKey || 'C');
      var kb = b.isMissing ? 99 : Transposer.noteNameToIndex(b.baseKey || 'C');
      cmp = ka - kb;
    } else if (col === 'status') {
      var rank = { 'Chords': 1, 'Key + Lyrics': 2, 'Lyrics': 3, 'Audio Only': 4, 'Missing': 5 };
      cmp = (rank[getStatusLabel(a)] || 9) - (rank[getStatusLabel(b)] || 9);
    } else if (col === 'language') {
      cmp = (a.language || '').localeCompare(b.language || '');
    } else if (col === 'credits') {
      cmp = getCreditSummaryText(a).localeCompare(getCreditSummaryText(b));
    } else if (col === 'scripture') {
      var sa = a.scripture || 'zzzz';
      var sb = b.scripture || 'zzzz';
      cmp = sa.localeCompare(sb);
    } else if (col === 'youtube') {
      var ya = a.youtubeUrl ? 0 : 1;
      var yb = b.youtubeUrl ? 0 : 1;
      cmp = ya - yb;
    }

    if (cmp !== 0) return cmp * dir;
    if (a.year !== b.year) return b.year - a.year;
    return a.title.localeCompare(b.title);
  }

  function getFilteredSongs() {
    var q = state.searchQuery.trim().toLowerCase();
    var all = getCatalogDataset();
    var out = [];
    for (var i = 0; i < all.length; i++) {
      var s = all[i];
      if (!matchesSearch(s, q)) continue;
      if (!matchesColumnFilters(s, null)) continue;
      out.push(s);
    }
    out.sort(compareSongs);
    return out;
  }

  function getSongTranspose(songId) {
    return Number(state.transposeMap[songId] || 0);
  }

  function getSongCapo(songId) {
    return Number(state.capoMap[songId] || 0);
  }

  function showToast(message) {
    var toast = document.getElementById('app-toast');
    var msgEl = document.getElementById('app-toast-msg');
    if (!toast || !msgEl) return;
    msgEl.textContent = message;
    toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-3');
    toast.classList.add('opacity-100', 'translate-y-0');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(function () {
      toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-3');
      toast.classList.remove('opacity-100', 'translate-y-0');
    }, 2400);
  }

  function copyTextToClipboard(text, successMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast(successMsg);
      }).catch(function () {
        fallbackCopy(text, successMsg);
      });
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', 'readonly');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast(successMsg);
    } catch (e) {
      showToast('Unable to copy automatically — please select and copy.');
    }
    document.body.removeChild(ta);
  }

  function applyTheme() {
    var root = document.documentElement;
    var sun = document.getElementById('theme-icon-sun');
    var moon = document.getElementById('theme-icon-moon');
    if (state.theme === 'dark') {
      root.classList.add('dark');
      if (sun) sun.classList.remove('hidden');
      if (moon) moon.classList.add('hidden');
    } else {
      root.classList.remove('dark');
      if (sun) sun.classList.add('hidden');
      if (moon) moon.classList.remove('hidden');
    }
  }

  function computeAutoFocusColumns(song) {
    var screenW = Number(window.innerWidth) || 1280;
    if (screenW < 768 || !song) return 1;

    var songHasChords = hasSongChords(song);
    var showChords = Boolean(state.focusShowChords && songHasChords);
    var secs = song.sections || [];
    var visibleSections = 0;
    var lengths = [];

    for (var s = 0; s < secs.length; s++) {
      var sec = secs[s];
      if (sec.instrumental && !showChords) continue;
      visibleSections++;

      if (showChords && sec.progression) {
        lengths.push(String(sec.progression).replace(/\s+/g, ' ').trim().length + 4);
      }

      var lines = sec.lines || [];
      for (var l = 0; l < lines.length; l++) {
        var raw = String(lines[l] || '');
        if (!raw.trim()) continue;
        var clean = raw.replace(/\[[^\]]+\]/g, '').replace(/[ \t]{2,}/g, ' ').trim();
        var chordMatches = raw.match(/\[[^\]]+\]/g);
        var chordCount = chordMatches ? chordMatches.length : 0;
        var effChars = clean.length + (showChords ? Math.round(chordCount * 1.6) : 0);
        if (effChars > 0) lengths.push(effChars);
      }
    }

    if (!visibleSections) return 1;

    var lineChars = 36;
    if (lengths.length) {
      lengths.sort(function (a, b) { return a - b; });
      var p90 = lengths[Math.floor((lengths.length - 1) * 0.9)];
      var maxLen = lengths[lengths.length - 1];
      lineChars = Math.max(22, Math.round(p90 * 0.7 + maxLen * 0.3));
    }

    var fontPx = 16.64 * (state.fontScale || 1.0);
    var neededColPx = Math.max(230 * (state.fontScale || 1.0), (lineChars * fontPx * 0.53) + 38);
    var availW = Math.min(screenW * 0.96, 1800) - 64;
    var gapPx = 44;
    var fitCols = Math.floor((availW + gapPx) / (neededColPx + gapPx));
    fitCols = Math.min(fitCols, visibleSections);
    return Math.max(1, Math.min(6, fitCols));
  }

  function getEffectiveFocusColumns(song) {
    var screenW = Number(window.innerWidth) || 1280;
    if (screenW < 768) return 1;
    if (state.focusColAuto) {
      return computeAutoFocusColumns(song);
    }
    return Math.max(1, Math.min(6, Number(state.focusManualCols) || 1));
  }

  function applyFocusModeDom() {
    var isFocus = state.activeView === 'song' && state.focusMode;
    var focusBar = document.getElementById('focus-floating-bar');
    var baseSong = getBaseSongById(state.selectedSongId);
    var container = document.getElementById('song-sections-container');

    if (isFocus) {
      document.body.classList.add('focus-mode');
      if (focusBar) {
        focusBar.classList.remove('hidden');
        focusBar.classList.add('flex');
      }
      var cols = getEffectiveFocusColumns(baseSong);
      document.documentElement.style.setProperty('--focus-col-count', String(cols));
      if (cols > 1) {
        document.body.classList.add('focus-multicol');
        if (container) container.classList.add('focus-columns-active');
      } else {
        document.body.classList.remove('focus-multicol');
        if (container) container.classList.remove('focus-columns-active');
      }

      var autoBtn = document.getElementById('focus-col-auto-btn');
      if (autoBtn) {
        autoBtn.textContent = 'Auto';
        autoBtn.className = state.focusColAuto
          ? 'px-2.5 py-1 rounded-full font-bold bg-indigo-600 text-white shadow-sm transition'
          : 'px-2.5 py-1 rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition';
      }
      var countLbl = document.getElementById('focus-col-count-label');
      if (countLbl) {
        countLbl.textContent = cols === 1 ? '1 Col' : (cols + ' Cols');
      }
      var decBtn = document.getElementById('focus-col-dec-btn');
      if (decBtn) decBtn.disabled = cols <= 1;
      var incBtn = document.getElementById('focus-col-inc-btn');
      if (incBtn) incBtn.disabled = cols >= 6;
    } else {
      document.body.classList.remove('focus-mode', 'focus-multicol');
      if (container) container.classList.remove('focus-columns-active');
      if (focusBar) {
        focusBar.classList.add('hidden');
        focusBar.classList.remove('flex');
      }
    }
    var chordBtn = document.getElementById('focus-chords-toggle-btn');
    if (chordBtn) {
      var songHasChords = hasSongChords(baseSong);
      if (!songHasChords) {
        chordBtn.textContent = 'Lyrics Only';
        chordBtn.disabled = true;
        chordBtn.className = 'px-2.5 py-1 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed';
      } else {
        chordBtn.disabled = false;
        chordBtn.textContent = state.focusShowChords ? 'Chords: On' : 'Chords: Off';
        chordBtn.className = state.focusShowChords
          ? 'px-2.5 py-1 rounded-full font-bold bg-indigo-600 text-white transition'
          : 'px-2.5 py-1 rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition';
      }
    }
  }

  function stopAutoScroll() {
    if (autoScrollTimer) {
      clearInterval(autoScrollTimer);
      autoScrollTimer = null;
    }
    state.autoScrollSpeed = 0;
    updateAutoScrollButton();
  }

  function cycleAutoScroll() {
    if (autoScrollTimer) {
      clearInterval(autoScrollTimer);
      autoScrollTimer = null;
    }
    state.autoScrollSpeed = (state.autoScrollSpeed + 1) % 4;
    if (state.autoScrollSpeed > 0) {
      var delayMs = state.autoScrollSpeed === 1 ? 75 : (state.autoScrollSpeed === 2 ? 42 : 24);
      autoScrollTimer = setInterval(function () {
        if (state.activeView !== 'song') {
          stopAutoScroll();
          return;
        }
        var atBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 4);
        if (atBottom) {
          stopAutoScroll();
          return;
        }
        window.scrollBy(0, 1);
      }, delayMs);
    }
    updateAutoScrollButton();
  }

  function updateAutoScrollButton() {
    var btn = document.getElementById('autoscroll-btn');
    if (!btn) return;
    if (state.autoScrollSpeed === 0) {
      btn.textContent = 'Scroll: Off';
      btn.className = 'px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition';
    } else {
      btn.textContent = 'Scroll: ' + state.autoScrollSpeed + 'x';
      btn.className = 'px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-indigo-500 bg-indigo-600 text-white shadow-sm transition';
    }
  }

  /* ==========================================================================
     SLIDE SHOW (1-WINDOW) & 2-WINDOW PRESENTER (CONTROL + DISPLAY)
     ========================================================================== */
  function buildSongSlides(song) {
    if (!song) return [];
    var slides = [];

    // 1. Title Slide
    var metaParts = [];
    if (song.camp) metaParts.push(song.camp);
    else if (song.year) metaParts.push(String(song.year));
    slides.push({
      index: 0,
      type: 'title',
      sectionLabel: 'Title',
      badgeLabel: 'Title',
      title: song.title,
      subtitle: metaParts.join(' • '),
      lines: []
    });

    // 2. Lyric Stanza Slides (chunked <= 4 lines per slide like PowerPoint / Proclaim)
    var secs = song.sections || [];
    for (var s = 0; s < secs.length; s++) {
      var sec = secs[s];
      if (sec.instrumental) continue;

      var cleanSecLabel = String(sec.label || 'Verse')
        .replace(/\s*\((?:key\s+|mod(?:ulate)?\s+)?[+-]\d+\)\s*/gi, '')
        .trim() || 'Verse';

      var rawLines = sec.lines || [];
      var subBlocks = [];
      var curBlock = [];

      for (var l = 0; l < rawLines.length; l++) {
        var rawLine = String(rawLines[l] || '');
        if (!rawLine.trim()) {
          if (curBlock.length) {
            subBlocks.push(curBlock);
            curBlock = [];
          }
          continue;
        }
        var plain = rawLine
          .replace(/\[[^\]]+\]/g, '')
          .replace(/[ \t]{2,}/g, ' ')
          .replace(/\bGoogle Drive\b|\bDrive\b/gi, 'archive')
          .trim();
        if (plain) {
          curBlock.push(plain);
        }
      }
      if (curBlock.length) subBlocks.push(curBlock);

      var secChunks = [];
      for (var b = 0; b < subBlocks.length; b++) {
        var blk = subBlocks[b];
        if (blk.length <= 4) {
          secChunks.push(blk);
        } else {
          var partsCount = Math.ceil(blk.length / 4);
          var startIdx = 0;
          for (var p = 0; p < partsCount; p++) {
            var remaining = blk.length - startIdx;
            var partsLeft = partsCount - p;
            var take = Math.ceil(remaining / partsLeft);
            secChunks.push(blk.slice(startIdx, startIdx + take));
            startIdx += take;
          }
        }
      }

      for (var c = 0; c < secChunks.length; c++) {
        var badge = secChunks.length > 1
          ? (cleanSecLabel + ' (' + (c + 1) + '/' + secChunks.length + ')')
          : cleanSecLabel;
        slides.push({
          index: slides.length,
          type: 'lyric',
          sectionLabel: cleanSecLabel,
          badgeLabel: badge,
          title: song.title,
          subtitle: '',
          lines: secChunks[c]
        });
      }
    }

    // 3. Final Blank / End Slide
    slides.push({
      index: slides.length,
      type: 'end',
      sectionLabel: 'End',
      badgeLabel: 'End (Blank)',
      title: song.title,
      subtitle: '',
      lines: []
    });

    return slides;
  }

  function renderProjectionSlideHtml(slide, isMonitorPreview, isAudienceDisplay, blackout) {
    if (!slide || blackout) {
      if (isMonitorPreview) {
        return '<div class="text-xs font-bold uppercase tracking-widest text-rose-400/90 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-800/50">Screen Blacked Out</div>';
      }
      return '';
    }

    if (slide.type === 'title') {
      if (isMonitorPreview) {
        return (
          '<div class="space-y-1.5 px-2">' +
            '<div class="text-lg sm:text-xl font-extrabold text-white tracking-tight">' + escapeHtml(slide.title) + '</div>' +
            (slide.subtitle ? '<div class="text-[11px] font-medium text-slate-400">' + escapeHtml(slide.subtitle) + '</div>' : '') +
          '</div>'
        );
      }
      return (
        '<div class="space-y-4 px-4">' +
          '<div class="slide-projection-title text-white">' + escapeHtml(slide.title) + '</div>' +
          (slide.subtitle ? '<div class="text-sm sm:text-xl font-semibold text-slate-400 tracking-wide">' + escapeHtml(slide.subtitle) + '</div>' : '') +
        '</div>'
      );
    }

    if (slide.type === 'end') {
      if (isMonitorPreview) {
        return '<div class="text-xs font-semibold uppercase tracking-widest text-slate-500">End of Song (Blank Slide)</div>';
      }
      if (isAudienceDisplay) {
        return '';
      }
      return '<div class="text-sm font-semibold uppercase tracking-widest text-slate-500">End of Slide Show</div>';
    }

    var linesHtml = [];
    for (var i = 0; i < slide.lines.length; i++) {
      linesHtml.push('<div class="mb-2 last:mb-0">' + escapeHtml(slide.lines[i]) + '</div>');
    }

    if (isMonitorPreview) {
      return '<div class="presenter-monitor-lines text-white px-2">' + linesHtml.join('') + '</div>';
    }
    return '<div class="slide-projection-lines text-white">' + linesHtml.join('') + '</div>';
  }

  function sendPresentationMessage(payload) {
    if (presentationChannel) {
      try {
        presentationChannel.postMessage(payload);
      } catch (e) {}
    }
    if (payload.type === 'soj_display_ready' || payload.type === 'soj_display_step') {
      safeSave(STORAGE_KEYS.presentationPing, payload);
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage(payload, '*');
        } catch (e) {}
      }
    } else {
      safeSave(STORAGE_KEYS.presentationSync, payload);
      if (presenterDisplayWin && !presenterDisplayWin.closed) {
        try {
          presenterDisplayWin.postMessage(payload, '*');
        } catch (e) {}
      }
    }
  }

  function broadcastPresentationState() {
    var song = getBaseSongById(state.selectedSongId);
    if (!song) return;
    var slides = buildSongSlides(song);
    if (state.slideIndex >= slides.length) state.slideIndex = Math.max(0, slides.length - 1);
    if (state.slideIndex < 0) state.slideIndex = 0;

    sendPresentationMessage({
      type: 'soj_present_state',
      songId: song.id,
      slideIndex: state.slideIndex,
      blackout: Boolean(state.slideBlackout),
      fontScale: Number(state.slideFontScale) || 1.0,
      ts: Date.now()
    });
  }

  function isDisplayWindowAlive() {
    if (presenterDisplayWin && !presenterDisplayWin.closed) return true;
    return Boolean(state.displayConnected);
  }

  function openDisplayPopupWindow() {
    var song = getBaseSongById(state.selectedSongId);
    if (!song) return;
    broadcastPresentationState();

    var baseHref = String(window.location.href || '').split('#')[0];
    var displayUrl = baseHref + '#/display/' + encodeURIComponent(song.id);

    if (presenterDisplayWin && !presenterDisplayWin.closed) {
      try {
        presenterDisplayWin.location.hash = '#/display/' + encodeURIComponent(song.id);
        presenterDisplayWin.focus();
      } catch (e) {}
      state.displayConnected = true;
      broadcastPresentationState();
      renderPresentationViews();
      return;
    }

    var opened = null;
    try {
      opened = window.open(displayUrl, 'soj_presentation_display', 'popup=yes,width=1280,height=720,resizable=yes');
    } catch (e) {
      opened = null;
    }

    if (opened) {
      presenterDisplayWin = opened;
      state.displayConnected = true;
      try { presenterDisplayWin.focus(); } catch (e) {}
      broadcastPresentationState();
      setTimeout(broadcastPresentationState, 150);
      setTimeout(broadcastPresentationState, 450);
    } else {
      state.displayConnected = false;
      showToast('Popup blocked — click "Open Display Window" to launch the display screen.');
    }
    renderPresentationViews();
  }

  function startSlideshowMode(resetSlide) {
    stopAutoScroll();
    state.focusMode = false;
    state.presenterActive = false;
    state.slideshowActive = true;
    if (resetSlide !== false) {
      state.slideIndex = 0;
      state.slideBlackout = false;
    }
    renderAll();
  }

  function startPresenterMode(fromCurrentSlide) {
    stopAutoScroll();
    state.focusMode = false;
    state.slideshowActive = false;
    state.presenterActive = true;
    if (!fromCurrentSlide) {
      state.slideIndex = 0;
      state.slideBlackout = false;
    }
    openDisplayPopupWindow();
    if (presenterMonitorTimer) clearInterval(presenterMonitorTimer);
    presenterMonitorTimer = setInterval(function () {
      if (!state.presenterActive) {
        clearInterval(presenterMonitorTimer);
        presenterMonitorTimer = null;
        return;
      }
      if (presenterDisplayWin && presenterDisplayWin.closed) {
        presenterDisplayWin = null;
        state.displayConnected = false;
        updatePresenterStatusBadge();
      }
    }, 1000);
    renderAll();
  }

  function exitPresentation() {
    var wasPresenter = state.presenterActive;
    state.slideshowActive = false;
    state.presenterActive = false;
    state.slideBlackout = false;
    state.displayConnected = false;

    if (presenterMonitorTimer) {
      clearInterval(presenterMonitorTimer);
      presenterMonitorTimer = null;
    }

    if (wasPresenter) {
      sendPresentationMessage({
        type: 'soj_present_close',
        songId: state.selectedSongId,
        ts: Date.now()
      });
      if (presenterDisplayWin && !presenterDisplayWin.closed) {
        try { presenterDisplayWin.close(); } catch (e) {}
      }
      presenterDisplayWin = null;
    }

    if (document.fullscreenElement && document.exitFullscreen) {
      try { document.exitFullscreen(); } catch (e) {}
    }

    renderAll();
  }

  function stepSlide(delta) {
    var song = getBaseSongById(state.selectedSongId);
    if (!song) return;
    var slides = buildSongSlides(song);
    if (!slides.length) return;
    var nextIdx = Math.max(0, Math.min(slides.length - 1, state.slideIndex + delta));
    state.slideIndex = nextIdx;
    if (state.presenterActive) {
      broadcastPresentationState();
    } else if (state.activeView === 'display') {
      sendPresentationMessage({
        type: 'soj_display_step',
        songId: song.id,
        slideIndex: state.slideIndex,
        blackout: state.slideBlackout,
        ts: Date.now()
      });
    }
    renderPresentationViews();
  }

  function goToSlide(index) {
    var song = getBaseSongById(state.selectedSongId);
    if (!song) return;
    var slides = buildSongSlides(song);
    if (!slides.length) return;
    state.slideIndex = Math.max(0, Math.min(slides.length - 1, Number(index) || 0));
    if (state.presenterActive) {
      broadcastPresentationState();
    }
    renderPresentationViews();
  }

  function toggleSlideBlackout() {
    state.slideBlackout = !state.slideBlackout;
    if (state.presenterActive) {
      broadcastPresentationState();
    } else if (state.activeView === 'display') {
      sendPresentationMessage({
        type: 'soj_display_step',
        songId: state.selectedSongId,
        slideIndex: state.slideIndex,
        blackout: state.slideBlackout,
        ts: Date.now()
      });
    }
    renderPresentationViews();
  }

  function adjustSlideFontScale(delta) {
    state.slideFontScale = Math.max(0.65, Math.min(1.65, Math.round((state.slideFontScale + delta) * 100) / 100));
    if (state.presenterActive) {
      broadcastPresentationState();
    }
    renderPresentationViews();
  }

  function toggleBrowserFullscreen() {
    var docEl = document.documentElement;
    if (!document.fullscreenElement) {
      if (docEl.requestFullscreen) {
        try { docEl.requestFullscreen(); } catch (e) {}
      }
    } else if (document.exitFullscreen) {
      try { document.exitFullscreen(); } catch (e) {}
    }
  }

  function updatePresenterStatusBadge() {
    var statusEl = document.getElementById('presenter-display-status');
    var openBtn = document.getElementById('presenter-open-display-btn');
    if (!statusEl) return;
    var alive = isDisplayWindowAlive();
    if (alive) {
      statusEl.textContent = 'Display Window Active';
      statusEl.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30';
      if (openBtn) openBtn.textContent = 'Focus / Reopen Display';
    } else {
      statusEl.textContent = 'Display Window Not Open';
      statusEl.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30';
      if (openBtn) openBtn.textContent = 'Open Display Window';
    }
  }

  function renderPresentationViews() {
    document.documentElement.style.setProperty('--slide-font-scale', String(state.slideFontScale || 1.0));

    var song = getBaseSongById(state.selectedSongId);
    var slides = song ? buildSongSlides(song) : [];
    if (state.slideIndex >= slides.length) state.slideIndex = Math.max(0, slides.length - 1);
    if (state.slideIndex < 0) state.slideIndex = 0;
    var curSlide = slides[state.slideIndex] || null;
    var nextSlide = (state.slideIndex + 1 < slides.length) ? slides[state.slideIndex + 1] : null;

    // 1. Display Window (#/display/<id>)
    if (state.activeView === 'display') {
      document.body.classList.add('display-window-mode');
      var dispStage = document.getElementById('display-window-stage');
      if (dispStage) {
        dispStage.innerHTML = renderProjectionSlideHtml(curSlide, false, true, state.slideBlackout);
      }
    } else {
      document.body.classList.remove('display-window-mode');
    }

    // 2. Single-Window Slide Show Overlay
    var ssOverlay = document.getElementById('slideshow-overlay');
    if (state.activeView === 'song' && state.slideshowActive && song) {
      document.body.classList.add('slideshow-active');
      if (ssOverlay) {
        ssOverlay.classList.remove('hidden');
        ssOverlay.classList.add('flex');
      }
      var ssTitle = document.getElementById('slideshow-song-title');
      if (ssTitle) ssTitle.textContent = song.title;
      var ssBadge = document.getElementById('slideshow-section-badge');
      if (ssBadge && curSlide) ssBadge.textContent = curSlide.badgeLabel;
      var ssCounter = document.getElementById('slideshow-counter');
      if (ssCounter) ssCounter.textContent = (state.slideIndex + 1) + ' / ' + slides.length;

      var ssBlackout = document.getElementById('slideshow-blackout-btn');
      if (ssBlackout) {
        ssBlackout.textContent = state.slideBlackout ? 'Blackout: ON (B)' : 'Blackout (B)';
        ssBlackout.className = state.slideBlackout
          ? 'px-2.5 py-1.5 rounded-lg font-bold bg-amber-500 text-slate-950 transition'
          : 'px-2.5 py-1.5 rounded-lg font-semibold bg-white/10 hover:bg-white/20 text-slate-200 transition';
      }

      var ssContent = document.getElementById('slideshow-slide-content');
      if (ssContent) {
        ssContent.innerHTML = renderProjectionSlideHtml(curSlide, false, false, state.slideBlackout);
      }

      var ssPrev = document.getElementById('slideshow-prev-btn');
      if (ssPrev) ssPrev.disabled = state.slideIndex <= 0;
      var ssNext = document.getElementById('slideshow-next-btn');
      if (ssNext) ssNext.disabled = state.slideIndex >= slides.length - 1;

      var ssStrip = document.getElementById('slideshow-strip');
      if (ssStrip) {
        var pills = [];
        for (var i = 0; i < slides.length; i++) {
          var sl = slides[i];
          var activePill = i === state.slideIndex;
          pills.push(
            '<button type="button" data-action="jump-slide" data-slide-idx="' + i + '" class="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ' +
              (activePill ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white/5 hover:bg-white/15 text-slate-300') + '">' +
              escapeHtml((i + 1) + '. ' + sl.badgeLabel) +
            '</button>'
          );
        }
        ssStrip.innerHTML = pills.join('');
      }
    } else {
      document.body.classList.remove('slideshow-active');
      if (ssOverlay) {
        ssOverlay.classList.add('hidden');
        ssOverlay.classList.remove('flex');
      }
    }

    // 3. Two-Window Presenter Control Overlay
    var prOverlay = document.getElementById('presenter-overlay');
    if (state.activeView === 'song' && state.presenterActive && song) {
      document.body.classList.add('presenter-active');
      if (prOverlay) {
        prOverlay.classList.remove('hidden');
        prOverlay.classList.add('flex');
      }
      updatePresenterStatusBadge();

      var prTitle = document.getElementById('presenter-song-title');
      if (prTitle) prTitle.textContent = song.title;
      var prCounter = document.getElementById('presenter-counter');
      if (prCounter) prCounter.textContent = 'Slide ' + (state.slideIndex + 1) + ' / ' + slides.length + (curSlide ? ' • ' + curSlide.badgeLabel : '');

      var prBlackout = document.getElementById('presenter-blackout-btn');
      if (prBlackout) {
        prBlackout.textContent = state.slideBlackout ? 'Blackout: ON (B)' : 'Blackout (B)';
        prBlackout.className = state.slideBlackout
          ? 'px-2.5 py-1.5 rounded-lg font-bold bg-amber-500 text-slate-950 transition'
          : 'px-2.5 py-1.5 rounded-lg font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition';
      }

      var curPrev = document.getElementById('presenter-current-preview');
      if (curPrev) {
        curPrev.innerHTML = renderProjectionSlideHtml(curSlide, true, false, state.slideBlackout);
      }

      var nextLbl = document.getElementById('presenter-next-label');
      if (nextLbl) {
        nextLbl.textContent = nextSlide ? nextSlide.badgeLabel : 'End of Deck';
      }
      var nextPrev = document.getElementById('presenter-next-preview');
      if (nextPrev) {
        nextPrev.innerHTML = nextSlide
          ? renderProjectionSlideHtml(nextSlide, true, false, false)
          : '<div class="text-xs font-medium text-slate-600">No further slides</div>';
      }

      var prPrev = document.getElementById('presenter-prev-btn');
      if (prPrev) prPrev.disabled = state.slideIndex <= 0;
      var prNext = document.getElementById('presenter-next-btn');
      if (prNext) prNext.disabled = state.slideIndex >= slides.length - 1;

      var deckCount = document.getElementById('presenter-deck-count');
      if (deckCount) deckCount.textContent = slides.length + ' slides';

      var deckList = document.getElementById('presenter-slide-list');
      if (deckList) {
        var cards = [];
        for (var d = 0; d < slides.length; d++) {
          var dSlide = slides[d];
          var isLive = d === state.slideIndex;
          var previewSnippet = dSlide.type === 'title'
            ? (dSlide.title + (dSlide.subtitle ? ' — ' + dSlide.subtitle : ''))
            : (dSlide.type === 'end' ? '(Blank end slide)' : dSlide.lines.join(' / '));
          cards.push(
            '<button type="button" data-action="jump-slide" data-slide-idx="' + d + '" class="w-full text-left rounded-xl p-2.5 border transition ' +
              (isLive
                ? 'border-indigo-500 bg-indigo-600/20 text-white shadow-sm'
                : 'border-slate-800/90 bg-slate-950/60 hover:bg-slate-800/70 text-slate-300') + '">' +
              '<div class="flex items-center justify-between gap-2 mb-1">' +
                '<span class="text-[11px] font-bold uppercase tracking-wider ' + (isLive ? 'text-indigo-300' : 'text-slate-400') + '">' +
                  escapeHtml((d + 1) + '. ' + dSlide.badgeLabel) +
                '</span>' +
                (isLive ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500 text-slate-950">Live</span>' : '') +
              '</div>' +
              '<div class="text-xs line-clamp-2 ' + (isLive ? 'text-white font-semibold' : 'text-slate-400') + '">' +
                escapeHtml(previewSnippet) +
              '</div>' +
            '</button>'
          );
        }
        deckList.innerHTML = cards.join('');
      }
    } else {
      document.body.classList.remove('presenter-active');
      if (prOverlay) {
        prOverlay.classList.add('hidden');
        prOverlay.classList.remove('flex');
      }
    }
  }

  function handleIncomingPresentationPayload(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'soj_present_state' && state.activeView === 'display') {
      if (msg.songId) {
        var found = getBaseSongById(msg.songId);
        if (found && found.id === msg.songId) {
          state.selectedSongId = msg.songId;
        }
      }
      if (typeof msg.slideIndex === 'number') state.slideIndex = msg.slideIndex;
      if (typeof msg.blackout === 'boolean') state.slideBlackout = msg.blackout;
      if (typeof msg.fontScale === 'number') state.slideFontScale = msg.fontScale;
      renderPresentationViews();
    } else if (msg.type === 'soj_present_close' && state.activeView === 'display') {
      try { window.close(); } catch (e) {}
      state.slideBlackout = true;
      renderPresentationViews();
    } else if (msg.type === 'soj_display_ready' && state.presenterActive) {
      state.displayConnected = true;
      updatePresenterStatusBadge();
      broadcastPresentationState();
    } else if (msg.type === 'soj_display_step' && state.presenterActive) {
      state.displayConnected = true;
      if (typeof msg.slideIndex === 'number') state.slideIndex = msg.slideIndex;
      if (typeof msg.blackout === 'boolean') state.slideBlackout = msg.blackout;
      renderPresentationViews();
    }
  }

  /* ==========================================================================
     VIEW SWITCHING & ROUTING
     ========================================================================== */
  function renderViewVisibility() {
    var views = ['browse', 'song', 'contact', 'display'];
    for (var i = 0; i < views.length; i++) {
      var el = document.getElementById('view-' + views[i]);
      if (!el) continue;
      if (state.activeView === views[i]) el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
    applyFocusModeDom();
    renderPresentationViews();
  }

  function navigateTo(view, songId, skipHash) {
    if (view !== 'song') {
      stopAutoScroll();
      state.focusMode = false;
      state.slideshowActive = false;
      if (state.presenterActive) {
        exitPresentation();
      }
    }
    closeAllPopovers();
    state.activeView = view;
    if (songId) state.selectedSongId = songId;

    if (!skipHash) {
      var nextHash = '#/';
      if (view === 'song') {
        nextHash = '#/song/' + encodeURIComponent(state.selectedSongId) + (state.focusMode ? '?focus=1' : '');
      } else if (view === 'display') {
        nextHash = '#/display/' + encodeURIComponent(state.selectedSongId);
      } else if (view === 'contact') {
        nextHash = '#/contact';
      }
      try {
        if (window.location.hash !== nextHash) {
          window.history.pushState(null, '', nextHash);
        }
      } catch (e) {
        // Ignore history restrictions on file:// if any
      }
    }

    renderAll();
    window.scrollTo(0, 0);
  }

  function syncFromHash() {
    var rawHash = window.location.hash || '';
    if (rawHash.indexOf('#/display/') === 0) {
      var dispRest = rawHash.slice(10);
      var dispQ = dispRest.indexOf('?');
      var dispSid = decodeURIComponent(dispQ === -1 ? dispRest : dispRest.slice(0, dispQ));
      var dispSong = getBaseSongById(dispSid);
      if (dispSong && dispSong.id === dispSid) {
        state.selectedSongId = dispSid;
      }
      state.activeView = 'display';
      state.focusMode = false;
      state.slideshowActive = false;
      state.presenterActive = false;

      var cached = safeLoad(STORAGE_KEYS.presentationSync, null);
      if (cached && cached.songId === state.selectedSongId) {
        state.slideIndex = Number(cached.slideIndex) || 0;
        state.slideBlackout = Boolean(cached.blackout);
        state.slideFontScale = Number(cached.fontScale) || 1.0;
      } else {
        state.slideIndex = 0;
        state.slideBlackout = false;
      }

      renderAll();

      var hintEl = document.getElementById('display-window-hint');
      if (hintEl) {
        hintEl.classList.remove('opacity-0');
        if (displayHintTimer) clearTimeout(displayHintTimer);
        displayHintTimer = setTimeout(function () {
          hintEl.classList.add('opacity-0');
        }, 3000);
      }

      sendPresentationMessage({
        type: 'soj_display_ready',
        songId: state.selectedSongId,
        ts: Date.now()
      });
      return;
    }
    if (rawHash.indexOf('#/song/') === 0) {
      var rest = rawHash.slice(7);
      var qIdx = rest.indexOf('?');
      var sid = decodeURIComponent(qIdx === -1 ? rest : rest.slice(0, qIdx));
      var query = qIdx === -1 ? '' : rest.slice(qIdx + 1);
      var found = getBaseSongById(sid);
      if (found && found.id === sid) {
        if (state.selectedSongId !== sid) {
          state.slideIndex = 0;
          state.slideBlackout = false;
        }
        state.selectedSongId = sid;
        state.activeView = 'song';
        state.focusMode = query.indexOf('focus=1') !== -1;
        renderAll();
        return;
      }
    } else if (rawHash === '#/contact') {
      state.activeView = 'contact';
      state.focusMode = false;
      state.slideshowActive = false;
      state.presenterActive = false;
      renderAll();
      return;
    }
    state.activeView = 'browse';
    state.focusMode = false;
    state.slideshowActive = false;
    state.presenterActive = false;
    renderAll();
  }

  /* ==========================================================================
     SPREADSHEET DIRECTORY + AUTO-FILTER POPOVER + PIVOT TABLE
     ========================================================================== */
  function getActiveColumns() {
    var cols = [];
    for (var i = 0; i < COLUMNS.length; i++) {
      if (state.visibleCols[COLUMNS[i].key]) cols.push(COLUMNS[i]);
    }
    return cols;
  }

  function areAllColumnsVisible() {
    for (var i = 0; i < COLUMNS.length; i++) {
      if (!state.visibleCols[COLUMNS[i].key]) return false;
    }
    return true;
  }

  function setAllColumnsVisible(showAll) {
    if (showAll) {
      for (var i = 0; i < COLUMNS.length; i++) {
        state.visibleCols[COLUMNS[i].key] = true;
      }
    } else {
      state.visibleCols = getDefaultVisibleCols();
    }
    state.visibleCols.title = true;
    safeSave(STORAGE_KEYS.visibleCols, state.visibleCols);
    renderBrowseView();
  }

  function updateToggleAllColsButton() {
    var btn = document.getElementById('toggle-all-cols-btn');
    var lbl = document.getElementById('toggle-all-cols-label');
    if (!btn) return;
    var allOpen = areAllColumnsVisible();
    if (lbl) {
      lbl.textContent = allOpen ? 'Compact View (3 Cols)' : 'Show All Columns';
    } else {
      btn.textContent = allOpen ? 'Compact View (3 Cols)' : 'Show All Columns';
    }
    btn.className = allOpen
      ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-600 bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 transition'
      : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-sky-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 transition';
  }

  function renderColumnsMenu() {
    var pop = document.getElementById('columns-menu-popover');
    if (!pop) return;
    var html = [
      '<div class="flex items-center justify-between gap-2 px-1.5 pb-1.5 border-b border-slate-100 dark:border-slate-800">',
        '<span class="font-bold text-[11px] uppercase tracking-wider text-slate-400">Columns</span>',
        '<span class="inline-flex items-center gap-2 text-[11px]">',
          '<button type="button" data-action="cols-show-all" class="font-semibold text-indigo-600 dark:text-sky-400 hover:underline">All</button>',
          '<span class="text-slate-300 dark:text-slate-700">&bull;</span>',
          '<button type="button" data-action="cols-default" class="font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:underline">Default (3)</button>',
        '</span>',
      '</div>'
    ];
    for (var i = 0; i < COLUMNS.length; i++) {
      var c = COLUMNS[i];
      var checked = Boolean(state.visibleCols[c.key]);
      html.push(
        '<label class="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">' +
          '<input type="checkbox" data-col-vis="' + escapeHtml(c.key) + '"' +
            (checked ? ' checked' : '') +
            (c.locked ? ' disabled' : '') +
            ' class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />' +
          '<span class="text-slate-700 dark:text-slate-200">' + escapeHtml(c.label) + '</span>' +
        '</label>'
      );
    }
    pop.innerHTML = html.join('');
  }

  function sortDimensionLabels(dim, values) {
    var copy = values.slice();
    if (dim === 'year') {
      copy.sort(function (a, b) { return Number(b) - Number(a); });
    } else if (dim === 'key') {
      copy.sort(function (a, b) {
        if (a === '—') return 1;
        if (b === '—') return -1;
        return Transposer.noteNameToIndex(a) - Transposer.noteNameToIndex(b);
      });
    } else if (dim === 'status') {
      var r = { 'Chords': 1, 'Key + Lyrics': 2, 'Lyrics': 3, 'Audio Only': 4, 'Missing': 5 };
      copy.sort(function (a, b) { return (r[a] || 9) - (r[b] || 9); });
    } else {
      copy.sort(function (a, b) { return a.localeCompare(b); });
    }
    return copy;
  }

  function openColumnFilterPopover(colKey, anchorEl) {
    var pop = document.getElementById('col-filter-popover');
    if (!pop) return;
    if (state.openFilterCol === colKey && !pop.classList.contains('hidden')) {
      closeAllPopovers();
      return;
    }
    state.openFilterCol = colKey;
    state.filterSearchText = '';
    renderColumnFilterPopoverContent();
    pop.classList.remove('hidden');

    var rect = anchorEl.getBoundingClientRect();
    var popWidth = 256;
    var left = Math.min(Math.max(8, rect.left), window.innerWidth - popWidth - 8);
    var top = Math.min(rect.bottom + 6, window.innerHeight - 340);
    pop.style.left = left + 'px';
    pop.style.top = Math.max(8, top) + 'px';

    var sInput = pop.querySelector('input[data-role="col-filter-search"]');
    if (sInput) sInput.focus();
  }

  function renderColumnFilterPopoverContent() {
    var pop = document.getElementById('col-filter-popover');
    var colKey = state.openFilterCol;
    if (!pop || !colKey) return;

    var colMeta = null;
    for (var i = 0; i < COLUMNS.length; i++) {
      if (COLUMNS[i].key === colKey) colMeta = COLUMNS[i];
    }
    if (!colMeta) return;

    // Compute distinct values & counts respecting search + OTHER column filters
    var q = state.searchQuery.trim().toLowerCase();
    var dataset = getCatalogDataset();
    var counts = {};
    var distinct = [];
    for (var d = 0; d < dataset.length; d++) {
      var song = dataset[d];
      if (!matchesSearch(song, q)) continue;
      if (!matchesColumnFilters(song, colKey)) continue;
      var vals = getDimensionValues(song, colKey);
      for (var v = 0; v < vals.length; v++) {
        var val = vals[v];
        if (!counts[val]) {
          counts[val] = 0;
          distinct.push(val);
        }
        counts[val]++;
      }
    }

    // Also keep any currently selected filter values visible even if count=0
    var selectedArr = state.colFilters[colKey] || [];
    for (var s = 0; s < selectedArr.length; s++) {
      if (counts[selectedArr[s]] == null) {
        counts[selectedArr[s]] = 0;
        distinct.push(selectedArr[s]);
      }
    }

    distinct = sortDimensionLabels(colKey, distinct);
    var filterSubQ = state.filterSearchText.trim().toLowerCase();

    var itemsHtml = [];
    for (var k = 0; k < distinct.length; k++) {
      var label = distinct[k];
      if (filterSubQ && label.toLowerCase().indexOf(filterSubQ) === -1) continue;
      var isChecked = !selectedArr.length || selectedArr.indexOf(label) !== -1;
      itemsHtml.push(
        '<label class="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">' +
          '<span class="flex items-center gap-2 min-w-0">' +
            '<input type="checkbox" data-role="col-filter-val" data-val="' + escapeHtml(label) + '"' + (isChecked ? ' checked' : '') + ' class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0" />' +
            '<span class="truncate text-slate-800 dark:text-slate-200">' + escapeHtml(label) + '</span>' +
          '</span>' +
          '<span class="font-mono-chord text-[11px] text-slate-400 shrink-0">' + counts[label] + '</span>' +
        '</label>'
      );
    }

    pop.innerHTML =
      '<div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">' +
        '<span class="font-bold text-slate-900 dark:text-white">Filter: ' + escapeHtml(colMeta.label) + '</span>' +
        '<button type="button" data-action="close-col-popover" class="text-slate-400 hover:text-slate-700 dark:hover:text-white text-sm font-bold px-1">&times;</button>' +
      '</div>' +
      '<div class="mt-2">' +
        '<input type="text" data-role="col-filter-search" value="' + escapeHtml(state.filterSearchText) + '" placeholder="Search ' + escapeHtml(colMeta.label.toLowerCase()) + '..." class="w-full px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />' +
      '</div>' +
      '<div class="flex items-center justify-between gap-2 my-2 px-0.5 text-[11px]">' +
        '<button type="button" data-action="col-filter-all" data-distinct-all="' + escapeHtml(JSON.stringify(distinct)) + '" class="font-semibold text-indigo-600 dark:text-sky-400 hover:underline">Select All (Reset)</button>' +
        '<button type="button" data-action="col-filter-only-none" data-distinct-all="' + escapeHtml(JSON.stringify(distinct)) + '" class="font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">Uncheck All</button>' +
      '</div>' +
      '<div data-role="col-filter-list" data-distinct-all="' + escapeHtml(JSON.stringify(distinct)) + '" class="max-h-52 overflow-y-auto space-y-0.5 border-t border-slate-100 dark:border-slate-800 pt-1.5">' +
        (itemsHtml.length ? itemsHtml.join('') : '<div class="py-3 text-center text-slate-400">No matching values</div>') +
      '</div>';
  }

  function closeAllPopovers() {
    state.openFilterCol = null;
    var pop = document.getElementById('col-filter-popover');
    if (pop) pop.classList.add('hidden');
    var colMenu = document.getElementById('columns-menu-popover');
    if (colMenu) colMenu.classList.add('hidden');
  }

  function renderActiveFilterChips() {
    var bar = document.getElementById('active-filters-bar');
    if (!bar) return;
    var chips = [];

    for (var i = 0; i < COLUMNS.length; i++) {
      var col = COLUMNS[i];
      var arr = state.colFilters[col.key];
      if (arr && arr.length) {
        chips.push(
          '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-sky-300 border border-indigo-200/80 dark:border-indigo-800/60">' +
            '<strong>' + escapeHtml(col.label) + ':</strong> ' + escapeHtml(arr.join(', ')) +
            '<button type="button" data-action="clear-col-filter" data-col="' + escapeHtml(col.key) + '" class="ml-0.5 font-bold hover:text-rose-600">&times;</button>' +
          '</span>'
        );
      }
    }

    if (!chips.length) {
      bar.classList.add('hidden');
      bar.classList.remove('flex');
      bar.innerHTML = '';
    } else {
      bar.classList.remove('hidden');
      bar.classList.add('flex');
      bar.innerHTML = '<span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">Active Filters:</span>' + chips.join('');
    }
  }

  function renderSongRowCells(song, activeCols) {
    var tds = [];
    var statusLabel = getStatusLabel(song);
    var statusCls = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    if (statusLabel === 'Chords') {
      statusCls = 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60';
    } else if (statusLabel === 'Key + Lyrics') {
      statusCls = 'bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60';
    } else if (statusLabel === 'Lyrics') {
      statusCls = 'bg-indigo-50 text-indigo-700 border border-indigo-200/70 dark:bg-indigo-950/50 dark:text-sky-300 dark:border-indigo-800/60';
    } else if (statusLabel === 'Missing') {
      statusCls = 'bg-rose-50 text-rose-700 border border-rose-200/70 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60';
    }

    for (var c = 0; c < activeCols.length; c++) {
      var key = activeCols[c].key;
      if (key === 'year') {
        tds.push('<td class="font-mono-chord font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">' + escapeHtml(song.year) + '</td>');
      } else if (key === 'title') {
        if (song.isMissing) {
          tds.push(
            '<td class="whitespace-nowrap">' +
              '<span class="font-semibold text-slate-400 dark:text-slate-500 italic">' + escapeHtml(song.title) + '</span>' +
              '<span class="ml-1.5 text-[11px] text-slate-400">(Missing)</span>' +
            '</td>'
          );
        } else {
          tds.push(
            '<td class="min-w-[200px]">' +
              '<a href="#/song/' + encodeURIComponent(song.id) + '" class="inline-flex items-center justify-between gap-3 w-full py-0.5 focus:outline-none">' +
                '<span class="min-w-0">' +
                  '<span class="font-bold text-indigo-700 dark:text-sky-400 underline decoration-indigo-300 dark:decoration-sky-500/60 decoration-2 underline-offset-4 group-hover:text-indigo-600 dark:group-hover:text-sky-300 group-hover:decoration-indigo-600 dark:group-hover:decoration-sky-300 transition">' + escapeHtml(song.title) + '</span>' +
                '</span>' +
                '<span class="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-sky-300 border border-indigo-200/80 dark:border-indigo-800/60 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition">' +
                  '<span>View</span><span aria-hidden="true">&rarr;</span>' +
                '</span>' +
              '</a>' +
            '</td>'
          );
        }
      } else if (key === 'camp') {
        tds.push('<td class="whitespace-nowrap text-slate-700 dark:text-slate-300">' + escapeHtml(song.camp || '—') + '</td>');
      } else if (key === 'key') {
        var kDisp = getDisplayKeyLabel(song);
        tds.push(
          '<td class="whitespace-nowrap font-mono-chord">' +
            (kDisp === '—'
              ? '<span class="text-slate-400">&mdash;</span>'
              : '<span class="px-1.5 py-0.5 rounded text-xs ' + (song.keyVerified ? 'font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400') + '">' + escapeHtml(kDisp) + '</span>') +
          '</td>'
        );
      } else if (key === 'status') {
        tds.push(
          '<td class="whitespace-nowrap">' +
            '<span class="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ' + statusCls + '">' + escapeHtml(statusLabel) + '</span>' +
          '</td>'
        );
      } else if (key === 'language') {
        tds.push('<td class="whitespace-nowrap text-slate-600 dark:text-slate-300 text-xs">' + escapeHtml(song.language || '—') + '</td>');
      } else if (key === 'credits') {
        tds.push('<td class="text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate" title="' + escapeHtml(getCreditSummaryText(song)) + '">' + escapeHtml(getCreditSummaryText(song)) + '</td>');
      } else if (key === 'scripture') {
        tds.push('<td class="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">' + escapeHtml(song.scripture || '—') + '</td>');
      } else if (key === 'youtube') {
        if (song.youtubeUrl) {
          tds.push(
            '<td class="whitespace-nowrap" data-stop-row-click="1">' +
              '<a href="' + escapeHtml(song.youtubeUrl) + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800/60 transition">' +
                '<span>YouTube</span><span aria-hidden="true">&#8599;</span>' +
              '</a>' +
            '</td>'
          );
        } else {
          tds.push('<td class="text-slate-300 dark:text-slate-700 text-xs whitespace-nowrap">&mdash;</td>');
        }
      }
    }
    return tds.join('');
  }

  function renderBrowseView() {
    updateToggleAllColsButton();
    renderColumnsMenu();
    renderActiveFilterChips();

    var clearBtn = document.getElementById('clear-search-btn');
    if (clearBtn) {
      if (state.searchQuery) clearBtn.classList.remove('hidden');
      else clearBtn.classList.add('hidden');
    }

    var activeCols = getActiveColumns();
    var filtered = getFilteredSongs();
    var totalPool = getCatalogDataset().length;

    var summaryEl = document.getElementById('results-summary-text');
    if (summaryEl) {
      summaryEl.textContent = filtered.length === totalPool
        ? (filtered.length + ' songs')
        : (filtered.length + ' of ' + totalPool + ' songs');
    }

    // Render Table Header with Sort & Excel AutoFilter Buttons
    var thead = document.getElementById('song-table-head');
    if (thead) {
      var ths = [];
      for (var c = 0; c < activeCols.length; c++) {
        var col = activeCols[c];
        var isSorted = state.sortCol === col.key;
        var sortIcon = isSorted ? (state.sortDir === 'asc' ? '&#8593;' : '&#8595;') : '&#8597;';
        var sortCls = isSorted ? 'text-indigo-700 dark:text-sky-400 font-extrabold' : 'text-slate-400 opacity-60 group-hover:opacity-100';
        var hasFilter = Boolean(state.colFilters[col.key] && state.colFilters[col.key].length);

        ths.push(
          '<th>' +
            '<div class="flex items-center justify-between gap-1.5">' +
              '<button type="button" data-action="sort-col" data-col="' + escapeHtml(col.key) + '" class="group inline-flex items-center gap-1 text-left focus:outline-none hover:text-indigo-700 dark:hover:text-sky-400 transition">' +
                '<span>' + escapeHtml(col.label) + '</span>' +
                '<span class="font-mono-chord text-[11px] ' + sortCls + '">' + sortIcon + '</span>' +
              '</button>' +
              (col.filterable
                ? '<button type="button" data-action="open-col-filter" data-col="' + escapeHtml(col.key) + '" title="Filter ' + escapeHtml(col.label) + '" class="col-filter-btn text-slate-400 ' + (hasFilter ? 'is-filtered' : '') + '">' +
                    '<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 4h18l-7 8.5V19l-4 2v-8.5L3 4z"/></svg>' +
                  '</button>'
                : '') +
            '</div>' +
          '</th>'
        );
      }
      thead.innerHTML = '<tr>' + ths.join('') + '</tr>';
    }

    var tbody = document.getElementById('song-table-body');
    var emptyBox = document.getElementById('empty-state-box');
    if (!tbody || !emptyBox) return;

    if (!filtered.length) {
      tbody.innerHTML = '';
      emptyBox.classList.remove('hidden');
      return;
    }
    emptyBox.classList.add('hidden');

    var rowsHtml = [];
    for (var r = 0; r < filtered.length; r++) {
      var s = filtered[r];
      var trCls = s.isMissing ? 'opacity-70 bg-slate-50/40 dark:bg-slate-900/30' : 'song-row group';
      var dataAttr = s.isMissing ? '' : ' data-action="row-open-song" data-song-id="' + escapeHtml(s.id) + '" tabindex="0"';
      rowsHtml.push('<tr class="' + trCls + '"' + dataAttr + '>' + renderSongRowCells(s, activeCols) + '</tr>');
    }

    tbody.innerHTML = rowsHtml.join('');
  }

  /* ==========================================================================
     SONG DETAIL VIEW (TITLE -> IMMEDIATELY CHORDS & LYRICS -> BOTTOM PANELS)
     ========================================================================== */
  function renderRecordingsBottomPanel(song) {
    var panel = document.getElementById('song-recordings-panel');
    if (!panel) return;
    panel.innerHTML = '';

    var hasYoutube = Boolean(song.youtubeUrl);
    var localTracks = [];
    var rawAudio = song.audioFiles || [];
    for (var i = 0; i < rawAudio.length; i++) {
      if (rawAudio[i].path) localTracks.push(rawAudio[i]);
    }

    if (!hasYoutube && !localTracks.length) {
      panel.classList.add('hidden');
      return;
    }

    panel.classList.remove('hidden');

    var header = document.createElement('div');
    header.className = 'flex flex-wrap items-center justify-between gap-2';
    header.innerHTML = '<span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Recordings</span>';
    if (hasYoutube) {
      var ytLink = document.createElement('a');
      ytLink.href = song.youtubeUrl;
      ytLink.target = '_blank';
      ytLink.rel = 'noopener noreferrer';
      ytLink.className = 'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition';
      ytLink.innerHTML = '<span>Watch on YouTube</span><span aria-hidden="true">&#8599;</span>';
      header.appendChild(ytLink);
    }
    panel.appendChild(header);

    if (localTracks.length) {
      var grid = document.createElement('div');
      grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-3 pt-1';
      var remainingLocal = localTracks.length;

      for (var t = 0; t < localTracks.length; t++) {
        (function (tr) {
          var card = document.createElement('div');
          card.className = 'rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-3 space-y-1.5';

          var cleanLabel = String(tr.label || 'Audio Recording')
            .replace(/\s*\([^)]*Drive[^)]*\)/gi, '')
            .trim();

          var lbl = document.createElement('div');
          lbl.className = 'text-xs font-semibold text-slate-800 dark:text-slate-200';
          lbl.textContent = cleanLabel;
          card.appendChild(lbl);

          var audioEl = document.createElement('audio');
          audioEl.controls = true;
          audioEl.preload = 'metadata';
          audioEl.className = 'w-full h-9';
          audioEl.addEventListener('error', function () {
            if (card.parentNode) card.parentNode.removeChild(card);
            remainingLocal--;
            if (remainingLocal <= 0) {
              if (grid.parentNode) grid.parentNode.removeChild(grid);
              if (!hasYoutube) panel.classList.add('hidden');
            }
          });
          audioEl.setAttribute('src', tr.path);
          card.appendChild(audioEl);
          grid.appendChild(card);
        })(localTracks[t]);
      }

      panel.appendChild(grid);
    }
  }

  function renderCreditsBottomPanel(song, concertKeyLabel, shapedKeyLabel, capo) {
    var panel = document.getElementById('song-credits-panel');
    if (!panel) return;

    var rows = [];
    rows.push(
      '<div class="flex flex-wrap items-center gap-2 mb-3">' +
        '<span class="px-2 py-0.5 rounded-md text-xs font-mono-chord font-bold bg-slate-900 text-white dark:bg-slate-700">' + escapeHtml(song.year) + '</span>' +
        '<span class="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-sky-300">' + escapeHtml(song.camp) + '</span>' +
        '<span class="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">' + escapeHtml(song.language) + '</span>' +
        (song.scripture ? '<span class="px-2.5 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">' + escapeHtml(song.scripture) + '</span>' : '') +
      '</div>'
    );

    rows.push('<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs text-slate-600 dark:text-slate-300">');
    if (song.lyricists && song.composers && song.lyricists !== song.composers) {
      rows.push('<div><strong class="text-slate-900 dark:text-white">Lyricist(s):</strong> ' + escapeHtml(song.lyricists) + '</div>');
      rows.push('<div><strong class="text-slate-900 dark:text-white">Composer(s):</strong> ' + escapeHtml(song.composers) + '</div>');
    } else {
      rows.push('<div class="sm:col-span-2"><strong class="text-slate-900 dark:text-white">Songwriters / Credits:</strong> ' + escapeHtml(song.credits || song.lyricists || 'Sounds of Joy (POJ Melbourne)') + '</div>');
    }

    if (song.performers) {
      rows.push('<div><strong class="text-slate-900 dark:text-white">Performers / Arrangement:</strong> ' + escapeHtml(song.performers) + '</div>');
    }

    var keyLine = '<strong class="text-slate-900 dark:text-white">Original Key:</strong> <span class="font-mono-chord font-semibold">' + escapeHtml(getDisplayKeyLabel(song)) + '</span>';
    if (capo > 0) {
      keyLine += ' &bull; Playing <span class="font-mono-chord font-semibold">' + escapeHtml(shapedKeyLabel) + '</span> shapes (Capo ' + capo + ' &rarr; ' + escapeHtml(concertKeyLabel) + ')';
    }
    rows.push('<div>' + keyLine + '</div>');

    if (song.keyNote) {
      var cleanKeyNote = song.keyNote.replace(/\bDrive\b/gi, 'archival');
      rows.push('<div class="sm:col-span-2 text-slate-500 dark:text-slate-400">' + escapeHtml(cleanKeyNote) + '</div>');
    }
    if (song.creditNote) {
      var cleanCreditNote = song.creditNote.replace(/\bGoogle Drive\b|\bDrive\b/gi, 'archive');
      rows.push('<div class="sm:col-span-2 italic text-slate-500 dark:text-slate-400">' + escapeHtml(cleanCreditNote) + '</div>');
    }
    rows.push('</div>');

    panel.innerHTML =
      '<div class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">Credits &amp; Song Details</div>' +
      rows.join('');
  }

  function renderSongDetailView() {
    var song = getBaseSongById(state.selectedSongId);
    if (!song) return;

    var songHasChords = hasSongChords(song);
    var baseKeyIdx = Transposer.noteNameToIndex(song.baseKey || 'G');
    var semitones = getSongTranspose(song.id);
    var capo = getSongCapo(song.id);
    var concertKeyIdx = Transposer.mod12(baseKeyIdx + semitones);
    var shapedKeyIdx = Transposer.mod12(concertKeyIdx - capo);

    var titleEl = document.getElementById('song-title-heading');
    if (titleEl) {
      titleEl.textContent = song.title;
    }

    // Effective notation mode: in Focus Mode, respect focusShowChords toggle
    var effectiveNotation = state.notationMode;
    if (state.focusMode) {
      if (!state.focusShowChords || !songHasChords) {
        effectiveNotation = 'lyrics';
      } else if (effectiveNotation === 'lyrics') {
        effectiveNotation = 'chords';
      }
    }

    // Sync Bottom Transpose Controls
    var keySelect = document.getElementById('target-key-select');
    if (keySelect) {
      var optsHtml = [];
      for (var k = 0; k < Transposer.KEY_OPTIONS.length; k++) {
        var ko = Transposer.KEY_OPTIONS[k];
        var isOrig = ko.index === baseKeyIdx;
        optsHtml.push(
          '<option value="' + ko.index + '"' + (ko.index === concertKeyIdx ? ' selected' : '') + '>' +
            'Key: ' + ko.label + (isOrig ? ' (Orig)' : '') +
          '</option>'
        );
      }
      keySelect.innerHTML = optsHtml.join('');
    }

    var accSelect = document.getElementById('accidental-select');
    if (accSelect) accSelect.value = state.accidentalPref;

    var capoSelect = document.getElementById('capo-select');
    if (capoSelect) capoSelect.value = String(capo);

    var modes = ['chords', 'nashville', 'lyrics'];
    for (var m = 0; m < modes.length; m++) {
      var mBtn = document.getElementById('notation-' + modes[m] + '-btn');
      if (mBtn) {
        var isAct = state.notationMode === modes[m];
        mBtn.className = isAct
          ? 'px-2.5 py-1 text-xs font-semibold rounded-md bg-indigo-600 text-white shadow-sm transition'
          : 'px-2.5 py-1 text-xs font-medium rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition';
      }
    }

    var twoColBtn = document.getElementById('two-col-btn');
    if (twoColBtn) {
      twoColBtn.className = state.twoColumn
        ? 'hidden md:inline-flex px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-indigo-500 bg-indigo-600 text-white transition'
        : 'hidden md:inline-flex px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition';
    }

    var concertKeyLabel = Transposer.indexToNoteName(concertKeyIdx, Transposer.shouldUseFlats(concertKeyIdx, state.accidentalPref));
    var shapedKeyLabel = Transposer.indexToNoteName(shapedKeyIdx, Transposer.shouldUseFlats(shapedKeyIdx, state.accidentalPref));
    var signedShift = semitones === 0 ? 'Original Key' : (semitones > 0 ? '+' + semitones + ' st' : semitones + ' st');

    var keyInlineEl = document.getElementById('key-status-inline');
    if (keyInlineEl) {
      if (songHasChords) {
        keyInlineEl.textContent = 'Concert Key: ' + concertKeyLabel + ' (' + signedShift + ')' + (capo > 0 ? ' • Capo ' + capo + ' -> Play ' + shapedKeyLabel : '');
      } else {
        keyInlineEl.textContent = song.keyVerified ? ('Archived Key: ' + song.baseKey + ' (Lyrics only)') : 'Lyrics archived (chords not yet transcribed)';
      }
    }

    // Render Song Sections Immediately Below Title
    var container = document.getElementById('song-sections-container');
    if (!container) return;

    document.documentElement.style.setProperty('--chord-font-scale', String(state.fontScale));

    var sheetClasses = ['song-sheet-body'];
    if (effectiveNotation === 'lyrics' || !songHasChords) sheetClasses.push('lyrics-only-mode');
    if (state.twoColumn && !state.focusMode) sheetClasses.push('two-column-stage');
    container.className = sheetClasses.join(' ');

    var renderOpts = {
      baseKeyIndex: baseKeyIdx,
      concertKeyIndex: concertKeyIdx,
      targetKeyIndex: shapedKeyIdx,
      notationMode: effectiveNotation,
      accidentalPref: state.accidentalPref,
      capo: capo
    };

    var secHtml = [];
    var secs = song.sections || [];
    for (var s = 0; s < secs.length; s++) {
      var sec = secs[s];
      if (sec.instrumental && effectiveNotation === 'lyrics') {
        continue;
      }
      var secMod = Transposer.getSectionModulation ? Transposer.getSectionModulation(sec.label) : 0;
      var secOpts = Transposer.shiftRenderOpts ? Transposer.shiftRenderOpts(renderOpts, secMod) : renderOpts;
      var modBadge = '';
      if (secMod !== 0 && effectiveNotation === 'chords' && songHasChords) {
        var modConcertName = Transposer.indexToNoteName(secOpts.concertKeyIndex, Transposer.shouldUseFlats(secOpts.concertKeyIndex, state.accidentalPref));
        var modShapeName = Transposer.indexToNoteName(secOpts.targetKeyIndex, Transposer.shouldUseFlats(secOpts.targetKeyIndex, state.accidentalPref));
        modBadge = '<span class="section-mod-badge text-xs font-mono-chord font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-sky-300">' +
          'Key: ' + escapeHtml(modConcertName) + (capo > 0 ? ' (Play ' + escapeHtml(modShapeName) + ')' : '') +
        '</span>';
      }

      var blockCls = 'song-section-block mb-6 last:mb-0' + (sec.instrumental ? ' instrumental-section' : '');
      var inner = [];

      var displayLabel = state.focusMode && effectiveNotation === 'lyrics'
        ? sec.label.replace(/\s*\((?:key\s+|mod(?:ulate)?\s+)?[+-]\d+\)\s*/gi, '').trim()
        : sec.label;

      inner.push(
        '<div class="flex flex-wrap items-center gap-2 mb-1.5">' +
          '<h2 class="section-heading-pill text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300">' +
            escapeHtml(displayLabel) +
          '</h2>' +
          modBadge +
        '</div>'
      );

      if (sec.progression && effectiveNotation !== 'lyrics' && songHasChords) {
        var progTokens = Transposer.formatProgressionBar(sec.progression, secOpts);
        if (progTokens.length) {
          var pSpans = [];
          for (var p = 0; p < progTokens.length; p++) {
            if (progTokens[p].type === 'sep') {
              pSpans.push('<span class="progression-bar-sep">' + escapeHtml(progTokens[p].text) + '</span>');
            } else {
              pSpans.push('<span class="progression-bar-chord">' + escapeHtml(progTokens[p].text) + '</span>');
            }
          }
          inner.push('<div class="progression-bar">' + pSpans.join('') + '</div>');
        }
      }

      var lines = sec.lines || [];
      for (var l = 0; l < lines.length; l++) {
        var rawLine = lines[l];
        if (!rawLine.trim()) {
          inner.push('<div class="h-3"></div>');
          continue;
        }
        var parsedLine = Transposer.parseChordProLine(rawLine, secOpts);
        if (!parsedLine.hasChords) {
          var plainLyricLine = (parsedLine.segments && parsedLine.segments[0]) ? parsedLine.segments[0].lyric : rawLine;
          if (!plainLyricLine.trim()) continue;
          var cleanArchiveLine = plainLyricLine.replace(/\bGoogle Drive\b|\bDrive\b/gi, 'archive');
          inner.push('<div class="mb-1.5 text-slate-800 dark:text-slate-100">' + escapeHtml(cleanArchiveLine) + '</div>');
        } else {
          var segSpans = [];
          for (var g = 0; g < parsedLine.segments.length; g++) {
            var seg = parsedLine.segments[g];
            var chordHtml = seg.chord
              ? '<span class="chord-token">' + escapeHtml(seg.chord) + '</span>'
              : '<span class="chord-token-empty" aria-hidden="true"></span>';
            var lyricText = seg.lyric || (sec.instrumental ? '   ' : '');
            segSpans.push(
              '<span class="chord-pair">' +
                chordHtml +
                '<span class="lyric-token text-slate-800 dark:text-slate-100">' + escapeHtml(lyricText) + '</span>' +
              '</span>'
            );
          }
          inner.push('<div class="chord-line">' + segSpans.join('') + '</div>');
        }
      }

      secHtml.push('<section class="' + blockCls + '">' + inner.join('') + '</section>');
    }

    container.innerHTML = secHtml.join('');

    // Render Bottom Recordings & Credits Panels
    renderRecordingsBottomPanel(song);
    renderCreditsBottomPanel(song, concertKeyLabel, shapedKeyLabel, capo);
    applyFocusModeDom();
  }

  function copyPlainLyricsForProclaim() {
    var song = getBaseSongById(state.selectedSongId);
    if (!song) return;
    var plain = Transposer.renderPlainLyricsForSlides(song, song.sections, {
      includeSectionLabels: state.proclaimIncludeHeaders
    });
    copyTextToClipboard(plain, 'Copied plain-text lyrics for "' + song.title + '" (Proclaim / Slides ready)');
  }

  function stepAdjacentSong(delta) {
    var filtered = getFilteredSongs(false).filter(function (s) { return !s.isMissing; });
    var list = filtered.length ? filtered : SONGS;
    var idx = 0;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === state.selectedSongId) {
        idx = i;
        break;
      }
    }
    var nextIdx = (idx + delta + list.length) % list.length;
    navigateTo('song', list[nextIdx].id, false);
  }

  function resetAllFilters() {
    state.searchQuery = '';
    state.colFilters = {};
    state.sortCol = 'year';
    state.sortDir = 'desc';
    var sIn = document.getElementById('search-input');
    if (sIn) sIn.value = '';
    closeAllPopovers();
    renderBrowseView();
  }

  function renderAll() {
    applyTheme();
    renderViewVisibility();
    renderBrowseView();
    if (state.activeView === 'song') {
      renderSongDetailView();
    }
    updateAutoScrollButton();
  }

  function tryHydrateLiveMarkdownFiles() {
    if (!window.fetch) return;
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return;
    window.fetch('songs/manifest.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (manifest) {
        if (!manifest || !Array.isArray(manifest.songs) || !manifest.songs.length) return;
        return Promise.all(manifest.songs.map(function (item) {
          return window.fetch(item.file, { cache: 'no-cache' })
            .then(function (res) { return res.ok ? res.text() : null; })
            .then(function (txt) {
              return txt ? MDParser.parseSongMarkdown(txt, item.file) : null;
            });
        }));
      })
      .then(function (loadedSongs) {
        if (!loadedSongs) return;
        var valid = loadedSongs.filter(Boolean);
        if (valid.length > 0) {
          SONGS = valid;
          renderAll();
        }
      })
      .catch(function () {
        // Fallback silently to pre-bundled window.SOJ_MD_SONGS
      });
  }

  /* ==========================================================================
     EVENT LISTENERS
     ========================================================================== */
  function bindEvents() {
    // Logo Home & Contact links
    document.getElementById('logo-home-link').addEventListener('click', function (e) {
      e.preventDefault();
      navigateTo('browse');
    });
    document.getElementById('footer-contact-link').addEventListener('click', function (e) {
      e.preventDefault();
      navigateTo('contact');
    });

    // Theme toggle
    document.getElementById('theme-toggle-btn').addEventListener('click', function () {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      safeSave(STORAGE_KEYS.theme, state.theme);
      applyTheme();
    });

    // Directory Search & Toolbar
    var searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', function (e) {
      state.searchQuery = e.target.value || '';
      renderBrowseView();
    });

    document.getElementById('clear-search-btn').addEventListener('click', function () {
      state.searchQuery = '';
      searchInput.value = '';
      renderBrowseView();
      searchInput.focus();
    });

    var toggleAllColsBtn = document.getElementById('toggle-all-cols-btn');
    if (toggleAllColsBtn) {
      toggleAllColsBtn.addEventListener('click', function () {
        setAllColumnsVisible(!areAllColumnsVisible());
      });
    }

    document.getElementById('columns-menu-btn').addEventListener('click', function (e) {
      e.stopPropagation();
      var pop = document.getElementById('columns-menu-popover');
      var isHidden = pop.classList.contains('hidden');
      closeAllPopovers();
      if (isHidden) {
        renderColumnsMenu();
        pop.classList.remove('hidden');
      }
    });

    document.getElementById('columns-menu-popover').addEventListener('change', function (e) {
      var colKey = e.target.getAttribute('data-col-vis');
      if (!colKey) return;
      state.visibleCols[colKey] = Boolean(e.target.checked);
      state.visibleCols.title = true;
      safeSave(STORAGE_KEYS.visibleCols, state.visibleCols);
      renderBrowseView();
    });

    document.getElementById('show-missing-checkbox').addEventListener('change', function (e) {
      state.showMissing = Boolean(e.target.checked);
      renderBrowseView();
    });

    document.getElementById('reset-filters-btn').addEventListener('click', resetAllFilters);
    document.getElementById('empty-reset-btn').addEventListener('click', resetAllFilters);

    // Column Filter Popover Internal Input & Checkbox Delegation
    var colPop = document.getElementById('col-filter-popover');
    colPop.addEventListener('input', function (e) {
      if (e.target.getAttribute('data-role') === 'col-filter-search') {
        state.filterSearchText = e.target.value || '';
        var cursorPos = e.target.selectionStart || state.filterSearchText.length;
        renderColumnFilterPopoverContent();
        var nextInput = colPop.querySelector('input[data-role="col-filter-search"]');
        if (nextInput) {
          nextInput.focus();
          try { nextInput.setSelectionRange(cursorPos, cursorPos); } catch (err) {}
        }
      }
    });

    colPop.addEventListener('change', function (e) {
      if (e.target.getAttribute('data-role') !== 'col-filter-val') return;
      var colKey = state.openFilterCol;
      if (!colKey) return;
      var listEl = colPop.querySelector('[data-role="col-filter-list"]');
      var allVals = [];
      try {
        allVals = JSON.parse(listEl.getAttribute('data-distinct-all') || '[]');
      } catch (err) {}

      var currentAllowed = state.colFilters[colKey] ? state.colFilters[colKey].slice() : allVals.slice();
      var val = e.target.getAttribute('data-val');
      if (e.target.checked) {
        if (currentAllowed.indexOf(val) === -1) currentAllowed.push(val);
      } else {
        var idx = currentAllowed.indexOf(val);
        if (idx !== -1) currentAllowed.splice(idx, 1);
      }

      if (currentAllowed.length === 0) {
        // Keep a sentinel so 0 matches shows empty state until re-checked or reset
        state.colFilters[colKey] = ['__NONE__'];
      } else if (currentAllowed.length >= allVals.length) {
        delete state.colFilters[colKey];
      } else {
        state.colFilters[colKey] = currentAllowed;
      }
      renderBrowseView();
    });

    // Song Page Top & Bottom Controls
    document.getElementById('back-to-browse-btn').addEventListener('click', function () {
      navigateTo('browse');
    });
    document.getElementById('prev-song-btn').addEventListener('click', function () {
      stepAdjacentSong(-1);
    });
    document.getElementById('next-song-btn').addEventListener('click', function () {
      stepAdjacentSong(1);
    });

    document.getElementById('enter-focus-btn').addEventListener('click', function () {
      state.focusMode = true;
      state.focusShowChords = false;
      renderSongDetailView();
      window.scrollTo(0, 0);
    });

    // Slide Show (1-Window) & 2-Window Presenter (Control + Display) Listeners
    var enterSlideshowBtn = document.getElementById('enter-slideshow-btn');
    if (enterSlideshowBtn) {
      enterSlideshowBtn.addEventListener('click', function () {
        startSlideshowMode(true);
      });
    }

    var enterPresenterBtn = document.getElementById('enter-presenter-btn');
    if (enterPresenterBtn) {
      enterPresenterBtn.addEventListener('click', function () {
        startPresenterMode(false);
      });
    }

    var ssDualBtn = document.getElementById('slideshow-dual-btn');
    if (ssDualBtn) {
      ssDualBtn.addEventListener('click', function () {
        startPresenterMode(true);
      });
    }

    var ssBlackoutBtn = document.getElementById('slideshow-blackout-btn');
    if (ssBlackoutBtn) ssBlackoutBtn.addEventListener('click', toggleSlideBlackout);
    var ssFontDecBtn = document.getElementById('slideshow-font-dec-btn');
    if (ssFontDecBtn) ssFontDecBtn.addEventListener('click', function () { adjustSlideFontScale(-0.1); });
    var ssFontIncBtn = document.getElementById('slideshow-font-inc-btn');
    if (ssFontIncBtn) ssFontIncBtn.addEventListener('click', function () { adjustSlideFontScale(0.1); });
    var ssFsBtn = document.getElementById('slideshow-fullscreen-btn');
    if (ssFsBtn) ssFsBtn.addEventListener('click', toggleBrowserFullscreen);
    var ssExitBtn = document.getElementById('slideshow-exit-btn');
    if (ssExitBtn) ssExitBtn.addEventListener('click', exitPresentation);
    var ssPrevBtn = document.getElementById('slideshow-prev-btn');
    if (ssPrevBtn) ssPrevBtn.addEventListener('click', function () { stepSlide(-1); });
    var ssNextBtn = document.getElementById('slideshow-next-btn');
    if (ssNextBtn) ssNextBtn.addEventListener('click', function () { stepSlide(1); });

    var ssStage = document.getElementById('slideshow-stage-area');
    if (ssStage) {
      ssStage.addEventListener('click', function (e) {
        var rect = ssStage.getBoundingClientRect();
        var relX = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.7;
        if (relX < 0.3) stepSlide(-1);
        else stepSlide(1);
      });
    }

    var prOpenDispBtn = document.getElementById('presenter-open-display-btn');
    if (prOpenDispBtn) prOpenDispBtn.addEventListener('click', openDisplayPopupWindow);
    var prBlackoutBtn = document.getElementById('presenter-blackout-btn');
    if (prBlackoutBtn) prBlackoutBtn.addEventListener('click', toggleSlideBlackout);
    var prFontDecBtn = document.getElementById('presenter-font-dec-btn');
    if (prFontDecBtn) prFontDecBtn.addEventListener('click', function () { adjustSlideFontScale(-0.1); });
    var prFontIncBtn = document.getElementById('presenter-font-inc-btn');
    if (prFontIncBtn) prFontIncBtn.addEventListener('click', function () { adjustSlideFontScale(0.1); });
    var prExitBtn = document.getElementById('presenter-exit-btn');
    if (prExitBtn) prExitBtn.addEventListener('click', exitPresentation);
    var prPrevBtn = document.getElementById('presenter-prev-btn');
    if (prPrevBtn) prPrevBtn.addEventListener('click', function () { stepSlide(-1); });
    var prNextBtn = document.getElementById('presenter-next-btn');
    if (prNextBtn) prNextBtn.addEventListener('click', function () { stepSlide(1); });

    var viewDisp = document.getElementById('view-display');
    if (viewDisp) {
      viewDisp.addEventListener('dblclick', toggleBrowserFullscreen);
    }

    if (presentationChannel) {
      presentationChannel.addEventListener('message', function (ev) {
        if (ev && ev.data) handleIncomingPresentationPayload(ev.data);
      });
    }

    window.addEventListener('message', function (ev) {
      if (ev && ev.data && typeof ev.data === 'object' && String(ev.data.type || '').indexOf('soj_') === 0) {
        handleIncomingPresentationPayload(ev.data);
      }
    });

    window.addEventListener('storage', function (ev) {
      if (!ev || !ev.newValue) return;
      if (ev.key === STORAGE_KEYS.presentationSync || ev.key === STORAGE_KEYS.presentationPing) {
        try {
          handleIncomingPresentationPayload(JSON.parse(ev.newValue));
        } catch (err) {}
      }
    });

    document.getElementById('exit-focus-btn').addEventListener('click', function () {
      state.focusMode = false;
      renderSongDetailView();
    });

    document.getElementById('focus-chords-toggle-btn').addEventListener('click', function () {
      var song = getBaseSongById(state.selectedSongId);
      if (!hasSongChords(song)) return;
      state.focusShowChords = !state.focusShowChords;
      renderSongDetailView();
    });

    var focusAutoBtn = document.getElementById('focus-col-auto-btn');
    if (focusAutoBtn) {
      focusAutoBtn.addEventListener('click', function () {
        var song = getBaseSongById(state.selectedSongId);
        if (state.focusColAuto) {
          state.focusManualCols = getEffectiveFocusColumns(song);
          state.focusColAuto = false;
        } else {
          state.focusColAuto = true;
        }
        applyFocusModeDom();
      });
    }

    var focusDecBtn = document.getElementById('focus-col-dec-btn');
    if (focusDecBtn) {
      focusDecBtn.addEventListener('click', function () {
        var song = getBaseSongById(state.selectedSongId);
        var cur = getEffectiveFocusColumns(song);
        state.focusColAuto = false;
        state.focusManualCols = Math.max(1, cur - 1);
        applyFocusModeDom();
      });
    }

    var focusIncBtn = document.getElementById('focus-col-inc-btn');
    if (focusIncBtn) {
      focusIncBtn.addEventListener('click', function () {
        var song = getBaseSongById(state.selectedSongId);
        var cur = getEffectiveFocusColumns(song);
        state.focusColAuto = false;
        state.focusManualCols = Math.min(6, cur + 1);
        applyFocusModeDom();
      });
    }

    document.getElementById('focus-font-dec-btn').addEventListener('click', function () {
      state.fontScale = Math.max(0.85, Math.round((state.fontScale - 0.1) * 100) / 100);
      renderSongDetailView();
    });
    document.getElementById('focus-font-inc-btn').addEventListener('click', function () {
      state.fontScale = Math.min(1.6, Math.round((state.fontScale + 0.1) * 100) / 100);
      renderSongDetailView();
    });

    document.getElementById('top-copy-proclaim-btn').addEventListener('click', copyPlainLyricsForProclaim);
    document.getElementById('copy-proclaim-btn').addEventListener('click', copyPlainLyricsForProclaim);
    document.getElementById('proclaim-headers-checkbox').addEventListener('change', function (e) {
      state.proclaimIncludeHeaders = Boolean(e.target.checked);
    });

    document.getElementById('transpose-down-btn').addEventListener('click', function () {
      var cur = getSongTranspose(state.selectedSongId) - 1;
      if (cur < -11) cur += 12;
      state.transposeMap[state.selectedSongId] = cur;
      if (state.notationMode === 'lyrics') state.notationMode = 'chords';
      renderSongDetailView();
    });

    document.getElementById('transpose-up-btn').addEventListener('click', function () {
      var cur = getSongTranspose(state.selectedSongId) + 1;
      if (cur > 11) cur -= 12;
      state.transposeMap[state.selectedSongId] = cur;
      if (state.notationMode === 'lyrics') state.notationMode = 'chords';
      renderSongDetailView();
    });

    document.getElementById('transpose-reset-btn').addEventListener('click', function () {
      state.transposeMap[state.selectedSongId] = 0;
      state.capoMap[state.selectedSongId] = 0;
      renderSongDetailView();
      showToast('Reset to original key');
    });

    document.getElementById('target-key-select').addEventListener('change', function (e) {
      var song = getBaseSongById(state.selectedSongId);
      if (!song) return;
      var baseIdx = Transposer.noteNameToIndex(song.baseKey || 'G');
      var desiredIdx = Number(e.target.value);
      var diff = desiredIdx - baseIdx;
      if (diff > 6) diff -= 12;
      if (diff < -6) diff += 12;
      state.transposeMap[song.id] = diff;
      if (state.notationMode === 'lyrics') state.notationMode = 'chords';
      renderSongDetailView();
    });

    document.getElementById('accidental-select').addEventListener('change', function (e) {
      state.accidentalPref = e.target.value;
      renderSongDetailView();
    });

    document.getElementById('capo-select').addEventListener('change', function (e) {
      state.capoMap[state.selectedSongId] = Number(e.target.value) || 0;
      if (state.notationMode === 'lyrics') state.notationMode = 'chords';
      renderSongDetailView();
    });

    document.getElementById('notation-chords-btn').addEventListener('click', function () {
      state.notationMode = 'chords';
      renderSongDetailView();
    });
    document.getElementById('notation-nashville-btn').addEventListener('click', function () {
      state.notationMode = 'nashville';
      renderSongDetailView();
    });
    document.getElementById('notation-lyrics-btn').addEventListener('click', function () {
      state.notationMode = 'lyrics';
      renderSongDetailView();
    });

    document.getElementById('font-dec-btn').addEventListener('click', function () {
      state.fontScale = Math.max(0.85, Math.round((state.fontScale - 0.1) * 100) / 100);
      renderSongDetailView();
    });
    document.getElementById('font-inc-btn').addEventListener('click', function () {
      state.fontScale = Math.min(1.6, Math.round((state.fontScale + 0.1) * 100) / 100);
      renderSongDetailView();
    });

    document.getElementById('two-col-btn').addEventListener('click', function () {
      state.twoColumn = !state.twoColumn;
      renderSongDetailView();
    });

    document.getElementById('autoscroll-btn').addEventListener('click', cycleAutoScroll);

    document.getElementById('copy-sheet-btn').addEventListener('click', function () {
      var song = getBaseSongById(state.selectedSongId);
      if (!song) return;
      var baseIdx = Transposer.noteNameToIndex(song.baseKey || 'G');
      var concertIdx = Transposer.mod12(baseIdx + getSongTranspose(song.id));
      var capo = getSongCapo(song.id);
      var shapedIdx = Transposer.mod12(concertIdx - capo);
      var plain = Transposer.renderPlainTextSheet(song, song.sections, {
        baseKeyIndex: baseIdx,
        concertKeyIndex: concertIdx,
        targetKeyIndex: shapedIdx,
        notationMode: state.notationMode,
        accidentalPref: state.accidentalPref,
        capo: capo
      });
      copyTextToClipboard(plain, 'Copied "' + song.title + '" chord sheet');
    });

    document.getElementById('print-sheet-btn').addEventListener('click', function () {
      window.print();
    });

    // Dedicated Contact Page Copy Button
    document.getElementById('copy-contact-page-btn').addEventListener('click', function () {
      copyTextToClipboard(CONTACT_EMAIL, 'Copied ' + CONTACT_EMAIL);
    });

    // Global Delegated Clicks (Table Sort, Column Filter Funnel, Row Clicks, Pivot Drill)
    document.addEventListener('click', function (e) {
      // Close popovers when clicking outside
      if (!e.target.closest('#col-filter-popover') && !e.target.closest('button[data-action="open-col-filter"]')) {
        var fPop = document.getElementById('col-filter-popover');
        if (fPop && !fPop.classList.contains('hidden')) {
          state.openFilterCol = null;
          fPop.classList.add('hidden');
        }
      }
      if (!e.target.closest('#columns-menu-popover') && !e.target.closest('#columns-menu-btn')) {
        var cPop = document.getElementById('columns-menu-popover');
        if (cPop && !cPop.classList.contains('hidden')) {
          cPop.classList.add('hidden');
        }
      }

      if (e.target.closest('[data-stop-row-click]')) return;

      var actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      var action = actionEl.getAttribute('data-action');

      if (action === 'row-open-song' || action === 'open-song') {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        var sid = actionEl.getAttribute('data-song-id');
        if (sid) navigateTo('song', sid, false);
      } else if (action === 'cols-show-all') {
        setAllColumnsVisible(true);
      } else if (action === 'cols-default') {
        setAllColumnsVisible(false);
      } else if (action === 'sort-col') {
        var col = actionEl.getAttribute('data-col');
        if (state.sortCol === col) {
          state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortCol = col;
          state.sortDir = col === 'year' ? 'desc' : 'asc';
        }
        renderBrowseView();
      } else if (action === 'open-col-filter') {
        e.stopPropagation();
        openColumnFilterPopover(actionEl.getAttribute('data-col'), actionEl);
      } else if (action === 'close-col-popover') {
        closeAllPopovers();
      } else if (action === 'col-filter-all') {
        if (state.openFilterCol) {
          delete state.colFilters[state.openFilterCol];
          renderColumnFilterPopoverContent();
          renderBrowseView();
        }
      } else if (action === 'col-filter-only-none') {
        if (state.openFilterCol) {
          state.colFilters[state.openFilterCol] = ['__NONE__'];
          renderColumnFilterPopoverContent();
          renderBrowseView();
        }
      } else if (action === 'clear-col-filter') {
        var cKey = actionEl.getAttribute('data-col');
        if (cKey) {
          delete state.colFilters[cKey];
          renderBrowseView();
        }
      } else if (action === 'jump-slide') {
        goToSlide(Number(actionEl.getAttribute('data-slide-idx') || 0));
      }
    });

    // Keyboard Accessibility: Slide Show / Presenter navigation, Enter on song rows, Escape, 'f' for Focus Mode
    document.addEventListener('keydown', function (e) {
      var inSlideControl = (state.activeView === 'song' && (state.slideshowActive || state.presenterActive)) || state.activeView === 'display';
      if (inSlideControl) {
        if (e.key === 'Escape' && state.activeView === 'song') {
          e.preventDefault();
          exitPresentation();
          return;
        }
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
          e.preventDefault();
          stepSlide(1);
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Backspace') {
          e.preventDefault();
          stepSlide(-1);
          return;
        }
        if (e.key === 'Home') {
          e.preventDefault();
          goToSlide(0);
          return;
        }
        if (e.key === 'End') {
          e.preventDefault();
          var curSong = getBaseSongById(state.selectedSongId);
          var totalSlides = curSong ? buildSongSlides(curSong).length : 1;
          goToSlide(totalSlides - 1);
          return;
        }
        if ((e.key === 'b' || e.key === 'B' || e.key === '.') && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          toggleSlideBlackout();
          return;
        }
        return;
      }

      if (e.key === 'Escape') {
        if (state.openFilterCol) {
          closeAllPopovers();
          return;
        }
        if (state.focusMode) {
          state.focusMode = false;
          renderSongDetailView();
          return;
        }
      }
      var tag = (e.target && e.target.tagName ? e.target.tagName : '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'Enter' && e.target && e.target.getAttribute && e.target.getAttribute('data-action') === 'row-open-song') {
        var sid = e.target.getAttribute('data-song-id');
        if (sid) navigateTo('song', sid, false);
      } else if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey && state.activeView === 'song') {
        e.preventDefault();
        state.focusMode = !state.focusMode;
        if (state.focusMode) state.focusShowChords = false;
        renderSongDetailView();
      }
    });

    window.addEventListener('resize', function () {
      if (state.activeView === 'song' && state.focusMode) {
        applyFocusModeDom();
      }
    });

    window.addEventListener('hashchange', syncFromHash);
  }

  bindEvents();
  syncFromHash();
  tryHydrateLiveMarkdownFiles();
})();
