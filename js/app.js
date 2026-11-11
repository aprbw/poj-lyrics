/**
 * Sounds of Joy — Interactive Markdown + YAML Worship Songbook Controller
 * Place of Joy (POJ) Melbourne — https://placeofjoy.org.au/
 * Maintainer & Contact: arian.prabowo@placeofjoy.org.au
 */

(function () {
  var MDParser = window.SOJMarkdown;
  var Transposer = window.SOJTransposer;
  var CONTACT_EMAIL = 'arian.prabowo@placeofjoy.org.au';
  var IS_CANVAS = Boolean(window.SOJ_IS_CANVAS);

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
    theme: 'soj_theme_v1',
    setlist: 'soj_setlist_v1',
    customMd: 'soj_custom_md_v2'
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
      // Ignore storage quota or sandbox iframe restrictions
    }
  }

  var state = {
    activeTab: 'browse',
    searchQuery: '',
    eraFilter: 'all',
    langFilter: 'all',
    mediaFilter: 'all',
    sortBy: 'newest',
    selectedSongId: 'rooted',
    transposeMap: {},      // songId -> integer semitones (-11..11)
    accidentalPref: 'auto',
    notationMode: 'chords',
    capoMap: {},           // songId -> integer fret (0..7)
    fontScale: 1.0,
    twoColumn: false,
    autoScrollSpeed: 0,
    theme: safeLoad(STORAGE_KEYS.theme, 'light'),
    setlist: safeLoad(STORAGE_KEYS.setlist, [
      { songId: 'rooted', targetKeyIndex: 7 },
      { songId: 'cerminan-mu', targetKeyIndex: 4 },
      { songId: 'i-am-free', targetKeyIndex: 0 },
      { songId: 'made-worthy', targetKeyIndex: 7 }
    ]),
    customMd: safeLoad(STORAGE_KEYS.customMd, {})
  };

  var autoScrollTimer = null;
  var toastTimeout = null;

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

  function getEffectiveSong(baseSong) {
    if (!baseSong) return null;
    var customRaw = state.customMd[baseSong.id];
    var song = customRaw
      ? MDParser.parseSongMarkdown(customRaw, baseSong.mdFile)
      : baseSong;

    var hasChords = song.chordStatus === 'chords-archived';
    if (!hasChords && song.sections) {
      for (var s = 0; s < song.sections.length; s++) {
        if (song.sections[s].progression) {
          hasChords = true;
          break;
        }
        var lines = song.sections[s].lines || [];
        for (var l = 0; l < lines.length; l++) {
          if (lines[l].indexOf('[') !== -1) {
            hasChords = true;
            break;
          }
        }
        if (hasChords) break;
      }
    }

    var audioList = song.audioFiles || [];
    var bundledAudioCount = 0;
    for (var a = 0; a < audioList.length; a++) {
      if (audioList[a].path) bundledAudioCount++;
    }

    return {
      song: song,
      baseKey: song.baseKey || 'G',
      sections: song.sections || [],
      isCustom: Boolean(customRaw),
      hasChords: hasChords,
      hasAnyAudio: audioList.length > 0,
      bundledAudioCount: bundledAudioCount
    };
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
    }, 2600);
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

  function triggerMarkdownDownload(filename, content) {
    try {
      var blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      showToast('Downloaded ' + filename);
    } catch (e) {
      copyTextToClipboard(content, 'Copied ' + filename + ' Markdown content to clipboard!');
    }
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
        if (state.activeTab !== 'song') {
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

  function cleanSortAuthor(song) {
    var raw = song.lyricists || song.composers || song.credits || '';
    return raw.replace(/^Lyrics\s*(&\s*Music)?\s*:\s*/i, '').trim();
  }

  function getFilteredSongs() {
    var q = state.searchQuery.trim().toLowerCase();
    var list = SONGS.filter(function (baseSong) {
      var eff = getEffectiveSong(baseSong);
      var song = eff.song;

      if (state.eraFilter === '2013-2016' && (song.year < 2013 || song.year > 2016)) return false;
      if (state.eraFilter === '2018-2019' && (song.year < 2018 || song.year > 2019)) return false;
      if (state.eraFilter === '2020-2026' && (song.year < 2020 || song.year > 2026)) return false;

      if (state.langFilter !== 'all' && song.language !== state.langFilter) return false;

      if (state.mediaFilter === 'chords' && !eff.hasChords) return false;
      if (state.mediaFilter === 'audio' && !eff.hasAnyAudio) return false;
      if (state.mediaFilter === 'bundled-audio' && eff.bundledAudioCount === 0) return false;
      if (state.mediaFilter === 'video' && !song.youtubeUrl) return false;

      if (!q) return true;
      var haystack = [
        song.title,
        song.altTitle || '',
        song.camp || '',
        String(song.year),
        song.credits || '',
        song.lyricists || '',
        song.composers || '',
        song.performers || '',
        song.scripture || '',
        song.language || '',
        song.mdFile || ''
      ].join(' ').toLowerCase();

      if (haystack.indexOf(q) !== -1) return true;

      for (var s = 0; s < eff.sections.length; s++) {
        var lines = eff.sections[s].lines || [];
        for (var l = 0; l < lines.length; l++) {
          var cleanLine = lines[l].replace(/\[[^\]]+\]/g, '').toLowerCase();
          if (cleanLine.indexOf(q) !== -1) return true;
        }
      }
      return false;
    });

    list.sort(function (aBase, bBase) {
      var aEff = getEffectiveSong(aBase);
      var bEff = getEffectiveSong(bBase);
      var a = aEff.song;
      var b = bEff.song;

      if (state.sortBy === 'oldest') {
        return a.year !== b.year ? a.year - b.year : a.title.localeCompare(b.title);
      }
      if (state.sortBy === 'az') {
        return a.title.localeCompare(b.title);
      }
      if (state.sortBy === 'za') {
        return b.title.localeCompare(a.title);
      }
      if (state.sortBy === 'author') {
        var cmpA = cleanSortAuthor(a).localeCompare(cleanSortAuthor(b));
        return cmpA !== 0 ? cmpA : (b.year - a.year);
      }
      if (state.sortBy === 'camp') {
        var cmpC = (a.camp || '').localeCompare(b.camp || '');
        return cmpC !== 0 ? cmpC : a.title.localeCompare(b.title);
      }
      if (state.sortBy === 'key') {
        var kA = Transposer.noteNameToIndex(aEff.baseKey);
        var kB = Transposer.noteNameToIndex(bEff.baseKey);
        return kA !== kB ? kA - kB : a.title.localeCompare(b.title);
      }
      if (state.sortBy === 'chords-first') {
        var cRankA = aEff.hasChords ? 0 : (a.chordStatus === 'key-archived' ? 1 : 2);
        var cRankB = bEff.hasChords ? 0 : (b.chordStatus === 'key-archived' ? 1 : 2);
        if (cRankA !== cRankB) return cRankA - cRankB;
        return b.year !== a.year ? b.year - a.year : a.title.localeCompare(b.title);
      }
      if (state.sortBy === 'audio-first') {
        var aRankA = aEff.bundledAudioCount > 0 ? 0 : (aEff.hasAnyAudio ? 1 : (a.youtubeUrl ? 2 : 3));
        var aRankB = bEff.bundledAudioCount > 0 ? 0 : (bEff.hasAnyAudio ? 1 : (b.youtubeUrl ? 2 : 3));
        if (aRankA !== aRankB) return aRankA - aRankB;
        return b.year !== a.year ? b.year - a.year : a.title.localeCompare(b.title);
      }
      // Default: 'newest'
      return b.year !== a.year ? b.year - a.year : a.title.localeCompare(b.title);
    });

    return list;
  }

  function isSongInSetlist(songId) {
    for (var i = 0; i < state.setlist.length; i++) {
      if (state.setlist[i].songId === songId) return true;
    }
    return false;
  }

  function getLyricSnippet(sections) {
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].instrumental || sections[i].label === 'Archive Note') continue;
      var lines = sections[i].lines || [];
      var collected = [];
      for (var j = 0; j < lines.length; j++) {
        var stripped = lines[j].replace(/\[[^\]]+\]/g, '').trim();
        if (stripped) collected.push(stripped);
        if (collected.length >= 2) break;
      }
      if (collected.length) return collected.join(' / ');
    }
    return '';
  }

  function renderNav() {
    var tabs = ['browse', 'song', 'setlist', 'deploy'];
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      var btn = document.getElementById('nav-' + t + '-btn');
      var view = document.getElementById('view-' + t);
      var active = state.activeTab === t;
      if (btn) {
        btn.className = active
          ? 'px-3 py-1.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white shadow-sm transition'
          : 'px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition';
      }
      if (view) {
        if (active) view.classList.remove('hidden');
        else view.classList.add('hidden');
      }
    }
    var badge = document.getElementById('setlist-count-badge');
    if (badge) {
      badge.textContent = String(state.setlist.length);
    }
  }

  function syncSortControls() {
    var sortSel = document.getElementById('sort-select');
    if (sortSel && sortSel.value !== state.sortBy) {
      sortSel.value = state.sortBy;
    }
    var pillWrap = document.getElementById('quick-sort-pills');
    if (!pillWrap) return;
    var buttons = pillWrap.querySelectorAll('button[data-action="quick-sort"]');
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var isAct = b.getAttribute('data-sort') === state.sortBy;
      b.className = isAct
        ? 'px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-sm transition'
        : 'px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition';
    }
  }

  function renderBrowseView() {
    syncSortControls();
    var filtered = getFilteredSongs();
    var summary = document.getElementById('results-summary-text');
    var grid = document.getElementById('song-grid');
    var emptyBox = document.getElementById('empty-state-box');
    var clearBtn = document.getElementById('clear-search-btn');

    if (clearBtn) {
      if (state.searchQuery) clearBtn.classList.remove('hidden');
      else clearBtn.classList.add('hidden');
    }

    var chordsCount = 0;
    var audioCount = 0;
    for (var c = 0; c < filtered.length; c++) {
      var ce = getEffectiveSong(filtered[c]);
      if (ce.hasChords) chordsCount++;
      if (ce.hasAnyAudio) audioCount++;
    }

    if (summary) {
      summary.textContent = 'Showing ' + filtered.length + ' of ' + SONGS.length + ' POJ songs (' + chordsCount + ' chord charts • ' + audioCount + ' with audio)';
    }

    if (!grid || !emptyBox) return;

    if (filtered.length === 0) {
      grid.innerHTML = '';
      emptyBox.classList.remove('hidden');
      return;
    }

    emptyBox.classList.add('hidden');
    var cardsHtml = [];

    for (var i = 0; i < filtered.length; i++) {
      var eff = getEffectiveSong(filtered[i]);
      var song = eff.song;
      var saved = isSongInSetlist(song.id);
      var snippet = getLyricSnippet(eff.sections);

      var statusBadge = '';
      if (eff.isCustom && eff.hasChords) {
        statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Custom .md (' + escapeHtml(eff.baseKey) + ')</span>';
      } else if (song.chordStatus === 'chords-archived') {
        statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Chords + Key ' + escapeHtml(eff.baseKey) + '</span>';
      } else if (song.chordStatus === 'key-archived') {
        statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Key ' + escapeHtml(eff.baseKey) + ' • Lyrics</span>';
      } else if (song.chordStatus === 'audio-archived') {
        statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">Audio Archive</span>';
      } else {
        statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">Lyrics Archived</span>';
      }

      var mediaBadges = [];
      if (eff.bundledAudioCount > 0) {
        mediaBadges.push('<span class="text-xs font-semibold text-emerald-600 dark:text-emerald-400">MP3/M4A (' + eff.bundledAudioCount + ')</span>');
      } else if (eff.hasAnyAudio) {
        mediaBadges.push('<span class="text-xs font-semibold text-teal-600 dark:text-teal-400">Drive Audio</span>');
      }
      if (song.youtubeUrl) {
        mediaBadges.push('<span class="text-xs font-medium text-rose-600 dark:text-rose-400">YouTube</span>');
      }
      if (song.driveLinks && song.driveLinks.length) {
        mediaBadges.push('<span class="text-xs font-medium text-sky-600 dark:text-sky-400">Drive Doc</span>');
      }

      cardsHtml.push(
        '<article class="group rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition flex flex-col justify-between">' +
          '<div>' +
            '<div class="flex items-center justify-between gap-2 mb-2.5">' +
              '<div class="flex flex-wrap items-center gap-1.5">' +
                '<span class="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-900 text-white dark:bg-slate-700">' + escapeHtml(song.year) + '</span>' +
                '<span class="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">' + escapeHtml(song.language) + '</span>' +
                statusBadge +
              '</div>' +
              '<button type="button" data-action="toggle-setlist" data-song-id="' + escapeHtml(song.id) + '" title="' + (saved ? 'Remove from Setlist' : 'Add to Setlist') + '" class="p-1.5 rounded-lg border ' + (saved ? 'border-amber-300 bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-400' : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:text-amber-500') + ' transition">' +
                '<svg class="w-4 h-4" fill="' + (saved ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>' +
              '</button>' +
            '</div>' +
            '<button type="button" data-action="open-song" data-song-id="' + escapeHtml(song.id) + '" class="text-left w-full focus:outline-none">' +
              '<h3 class="text-lg font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-sky-400 transition">' + escapeHtml(song.title) + '</h3>' +
              '<p class="text-xs font-medium text-indigo-600 dark:text-sky-400 mt-0.5">' + escapeHtml(song.camp) + (song.scripture ? ' • ' + escapeHtml(song.scripture) : '') + '</p>' +
              '<p class="text-xs text-slate-600 dark:text-slate-300 mt-1.5 line-clamp-2"><span class="font-semibold text-slate-700 dark:text-slate-200">Credit:</span> ' + escapeHtml(song.credits || song.writers) + '</p>' +
              (snippet ? '<p class="text-sm text-slate-600 dark:text-slate-400 mt-2.5 italic line-clamp-2">“' + escapeHtml(snippet) + '”</p>' : '') +
            '</button>' +
          '</div>' +
          '<div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">' +
            '<div class="flex flex-wrap items-center gap-2">' + (mediaBadges.join('<span class="text-slate-300 dark:text-slate-700">•</span>') || '<span class="text-xs font-mono-chord text-slate-400">' + escapeHtml(song.mdFile) + '</span>') + '</div>' +
            '<button type="button" data-action="open-song" data-song-id="' + escapeHtml(song.id) + '" class="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-sky-400 hover:underline shrink-0">' +
              'Open Sheet &rarr;' +
            '</button>' +
          '</div>' +
        '</article>'
      );
    }

    grid.innerHTML = cardsHtml.join('');
  }

  function renderAudioPanel(song) {
    var panel = document.getElementById('song-audio-panel');
    if (!panel) return;
    var tracks = song.audioFiles || [];
    if (!tracks.length) {
      panel.classList.add('hidden');
      panel.innerHTML = '';
      return;
    }

    panel.classList.remove('hidden');
    panel.className = 'mb-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/60 p-4 space-y-3 no-print';
    panel.innerHTML = '';

    var heading = document.createElement('div');
    heading.className = 'flex flex-wrap items-center justify-between gap-2';
    heading.innerHTML =
      '<span class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">Original Audio Recordings (' + tracks.length + ')</span>' +
      (IS_CANVAS ? '<span class="text-[11px] text-slate-500 dark:text-slate-400">Bundled MP3/M4A files included in <code class="font-mono-chord">sounds-of-joy.zip</code></span>' : '');
    panel.appendChild(heading);

    var listWrap = document.createElement('div');
    listWrap.className = 'grid grid-cols-1 md:grid-cols-2 gap-3';

    for (var i = 0; i < tracks.length; i++) {
      var tr = tracks[i];
      var card = document.createElement('div');
      card.className = 'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 flex flex-col justify-between gap-2';

      var topRow = document.createElement('div');
      topRow.className = 'flex items-start justify-between gap-2';

      var labelSpan = document.createElement('div');
      labelSpan.className = 'text-xs font-semibold text-slate-800 dark:text-slate-100';
      labelSpan.textContent = tr.label || 'Audio Track';
      topRow.appendChild(labelSpan);

      if (tr.driveUrl) {
        var dLink = document.createElement('a');
        dLink.href = tr.driveUrl;
        dLink.target = '_blank';
        dLink.rel = 'noopener noreferrer';
        dLink.className = 'shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800/60 transition';
        dLink.innerHTML = '<span>Drive Stream</span><span aria-hidden="true">&#8599;</span>';
        topRow.appendChild(dLink);
      }
      card.appendChild(topRow);

      if (tr.path && !IS_CANVAS) {
        var audioEl = document.createElement('audio');
        audioEl.controls = true;
        audioEl.preload = 'metadata';
        audioEl.className = 'w-full h-9 mt-1';
        audioEl.addEventListener('error', function () {
          var fallback = document.createElement('div');
          fallback.className = 'text-[11px] text-slate-500 dark:text-slate-400';
          fallback.textContent = tr.driveUrl
            ? 'Local audio/ not present — stream directly from POJ Google Drive above.'
            : 'Local audio file not present.';
          if (audioEl.parentNode) {
            audioEl.parentNode.replaceChild(fallback, audioEl);
          }
        });
        audioEl.setAttribute('src', tr.path);
        card.appendChild(audioEl);
      } else if (tr.path && IS_CANVAS) {
        var pathBadge = document.createElement('div');
        pathBadge.className = 'text-[11px] text-emerald-700 dark:text-emerald-400 font-mono-chord bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded';
        pathBadge.textContent = 'Bundled in zip: ' + tr.path;
        card.appendChild(pathBadge);
      } else {
        var streamInfo = document.createElement('div');
        streamInfo.className = 'text-[11px] text-slate-500 dark:text-slate-400';
        streamInfo.textContent = 'Stream high-bitrate recording directly from POJ Google Drive above.';
        card.appendChild(streamInfo);
      }

      listWrap.appendChild(card);
    }

    panel.appendChild(listWrap);
  }

  function renderSongDetailView() {
    var baseSong = getBaseSongById(state.selectedSongId);
    if (!baseSong) return;

    var eff = getEffectiveSong(baseSong);
    var song = eff.song;
    var baseKeyIdx = Transposer.noteNameToIndex(eff.baseKey);
    var semitones = getSongTranspose(song.id);
    var capo = getSongCapo(song.id);
    var concertKeyIdx = Transposer.mod12(baseKeyIdx + semitones);
    var shapedKeyIdx = Transposer.mod12(concertKeyIdx - capo);

    var badgesEl = document.getElementById('song-header-badges');
    var titleEl = document.getElementById('song-title-heading');
    var metaEl = document.getElementById('song-meta-subtitle');
    var creditsDetailEl = document.getElementById('song-credits-detail');
    var linksEl = document.getElementById('song-external-links');
    var setlistBtn = document.getElementById('toggle-setlist-current-btn');
    var contactCardEl = document.getElementById('song-contact-card');

    if (badgesEl) {
      badgesEl.innerHTML =
        '<span class="px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-900 text-white dark:bg-slate-700">' + escapeHtml(song.year) + '</span>' +
        '<span class="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-sky-300">' + escapeHtml(song.camp) + '</span>' +
        '<span class="px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">' + escapeHtml(song.language) + '</span>' +
        (song.scripture ? '<span class="px-2.5 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">' + escapeHtml(song.scripture) + '</span>' : '') +
        '<span class="px-2.5 py-0.5 rounded-md text-xs font-mono-chord bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">' + escapeHtml(song.mdFile) + '</span>';
    }

    if (titleEl) {
      titleEl.textContent = song.title + (song.altTitle ? ' (' + song.altTitle + ')' : '');
    }

    if (metaEl) {
      metaEl.textContent = song.credits || song.writers || '';
    }

    if (creditsDetailEl) {
      var detailRows = [];
      if (song.lyricists && song.composers && song.lyricists !== song.composers) {
        detailRows.push('<div><strong>Lyricist(s):</strong> ' + escapeHtml(song.lyricists) + ' &bull; <strong>Composer(s):</strong> ' + escapeHtml(song.composers) + '</div>');
      } else if (song.lyricists) {
        detailRows.push('<div><strong>Author / Composer Credit:</strong> ' + escapeHtml(song.lyricists) + '</div>');
      }
      if (song.performers) {
        detailRows.push('<div><strong>Performers / Arrangement:</strong> ' + escapeHtml(song.performers) + '</div>');
      }
      if (song.creditNote) {
        detailRows.push('<div class="italic">' + escapeHtml(song.creditNote) + '</div>');
      }
      creditsDetailEl.innerHTML = detailRows.join('');
    }

    if (linksEl) {
      var extHtml = [];
      if (song.youtubeUrl) {
        extHtml.push(
          '<a href="' + escapeHtml(song.youtubeUrl) + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800/60 transition">' +
            '<span>Watch on YouTube</span><span aria-hidden="true">&#8599;</span>' +
          '</a>'
        );
      }
      var dLinks = song.driveLinks || [];
      for (var d = 0; d < dLinks.length; d++) {
        extHtml.push(
          '<a href="' + escapeHtml(dLinks[d].url) + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800/60 transition">' +
            '<span>' + escapeHtml(dLinks[d].label) + '</span><span aria-hidden="true">&#8599;</span>' +
          '</a>'
        );
      }
      linksEl.innerHTML = extHtml.join('');
    }

    renderAudioPanel(song);

    var inList = isSongInSetlist(song.id);
    if (setlistBtn) {
      setlistBtn.textContent = inList ? '★ Saved in Setlist' : '☆ Save to Setlist';
      setlistBtn.className = inList
        ? 'px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:border-amber-600 dark:text-amber-300 transition'
        : 'px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition';
    }

    // Sync Toolbar Selects & Segmented Buttons
    var keySelect = document.getElementById('target-key-select');
    if (keySelect) {
      var optsHtml = [];
      for (var k = 0; k < Transposer.KEY_OPTIONS.length; k++) {
        var ko = Transposer.KEY_OPTIONS[k];
        var isOrig = ko.index === baseKeyIdx;
        optsHtml.push(
          '<option value="' + ko.index + '"' + (ko.index === concertKeyIdx ? ' selected' : '') + '>' +
            'Key: ' + ko.label + (isOrig ? ' (Base)' : '') +
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

    // Status Banner
    var bannerEl = document.getElementById('key-status-banner');
    var concertKeyLabel = Transposer.indexToNoteName(concertKeyIdx, Transposer.shouldUseFlats(concertKeyIdx, state.accidentalPref));
    var shapedKeyLabel = Transposer.indexToNoteName(shapedKeyIdx, Transposer.shouldUseFlats(shapedKeyIdx, state.accidentalPref));
    var signedShift = semitones === 0 ? '0' : (semitones > 0 ? '+' + semitones : String(semitones));

    if (bannerEl) {
      if (eff.hasChords) {
        bannerEl.className = 'mb-5 rounded-xl border border-indigo-200/80 dark:border-sky-900/60 bg-indigo-50/70 dark:bg-slate-800/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs';
        bannerEl.innerHTML =
          '<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-700 dark:text-slate-200">' +
            '<span><strong>Concert Key:</strong> <span class="font-mono-chord font-bold text-indigo-700 dark:text-sky-400">' + escapeHtml(concertKeyLabel) + '</span> (' + signedShift + ' st)</span>' +
            (capo > 0 ? '<span><strong>Capo ' + capo + ':</strong> Play <span class="font-mono-chord font-bold text-emerald-700 dark:text-emerald-400">' + escapeHtml(shapedKeyLabel) + '</span> shapes</span>' : '') +
            (song.keyNote && !eff.isCustom ? '<span class="text-slate-500 dark:text-slate-400">• ' + escapeHtml(song.keyNote) + '</span>' : '') +
            (eff.isCustom ? '<span class="text-emerald-700 dark:text-emerald-400 font-semibold">• Custom Markdown (.md) Saved</span>' : '') +
          '</div>' +
          '<button type="button" data-action="open-editor" class="font-semibold text-indigo-600 dark:text-sky-400 hover:underline no-print">Edit .md / Chords</button>';
      } else {
        var noteDetail = song.chordStatus === 'key-archived'
          ? 'Archived Key: <strong>' + escapeHtml(eff.baseKey) + '</strong> (' + escapeHtml(song.keyNote || 'from POJ Camp Schedule') + '). Full chord placements were not in the Drive lyric doc.'
          : (song.chordStatus === 'audio-archived'
            ? 'Audio recording archived on POJ YouTube; written lyrics & chords have not yet been transcribed in Drive.'
            : 'Verbatim lyrics archived from POJ CCM records; chord placements were not included in the Drive folder.');
        bannerEl.className = 'mb-5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 no-print';
        bannerEl.innerHTML =
          '<div>' + noteDetail + ' Add <code class="font-mono-chord bg-amber-100 dark:bg-amber-900/50 px-1 rounded">[Chord]</code> tags in Markdown to enable live transposition.</div>' +
          '<button type="button" data-action="open-editor" class="px-3 py-1.5 rounded-lg font-semibold bg-amber-600 hover:bg-amber-700 text-white transition shrink-0">+ Edit .md / Add Chords</button>';
      }
    }

    // Render Sections & Chords
    var container = document.getElementById('song-sections-container');
    if (!container) return;

    document.documentElement.style.setProperty('--chord-font-scale', String(state.fontScale));

    var sheetClasses = ['song-sheet-body'];
    if (state.notationMode === 'lyrics') sheetClasses.push('lyrics-only-mode');
    if (state.twoColumn) sheetClasses.push('two-column-stage');
    container.className = sheetClasses.join(' ');

    var renderOpts = {
      baseKeyIndex: baseKeyIdx,
      concertKeyIndex: concertKeyIdx,
      targetKeyIndex: shapedKeyIdx,
      notationMode: state.notationMode,
      accidentalPref: state.accidentalPref,
      capo: capo
    };

    var secHtml = [];
    for (var s = 0; s < eff.sections.length; s++) {
      var sec = eff.sections[s];
      var blockCls = 'song-section-block mb-7 last:mb-0' + (sec.instrumental ? ' instrumental-section' : '');
      var inner = [];

      inner.push(
        '<div class="flex flex-wrap items-center gap-2.5 mb-2">' +
          '<h4 class="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">' +
            escapeHtml(sec.label) +
          '</h4>' +
        '</div>'
      );

      if (sec.progression && state.notationMode !== 'lyrics') {
        var progTokens = Transposer.formatProgressionBar(sec.progression, renderOpts);
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
        var parsedLine = Transposer.parseChordProLine(rawLine, renderOpts);
        if (!parsedLine.hasChords) {
          inner.push('<div class="mb-1.5 text-slate-800 dark:text-slate-100">' + escapeHtml(rawLine) + '</div>');
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

    if (contactCardEl) {
      var mailSubject = encodeURIComponent('Sounds of Joy Update: ' + song.title + ' (' + song.mdFile + ')');
      contactCardEl.innerHTML =
        '<div>' +
          'Issues or updates for <strong>' + escapeHtml(song.title) + '</strong> (lyrics, chords, attributions, links, audio, or camp details)? Contact <strong>Arian Prabowo</strong> at ' +
          '<a href="mailto:' + CONTACT_EMAIL + '?subject=' + mailSubject + '" class="font-semibold text-indigo-600 dark:text-sky-400 underline">' + CONTACT_EMAIL + '</a>.' +
        '</div>' +
        '<button type="button" data-action="copy-contact-email" class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition">' +
          'Copy Email' +
        '</button>';
    }
  }

  function renderSetlistView() {
    var listEl = document.getElementById('setlist-items-container');
    var emptyEl = document.getElementById('setlist-empty-box');
    if (!listEl || !emptyEl) return;

    if (state.setlist.length === 0) {
      listEl.innerHTML = '';
      emptyEl.classList.remove('hidden');
      return;
    }

    emptyEl.classList.add('hidden');
    var rows = [];
    for (var i = 0; i < state.setlist.length; i++) {
      var item = state.setlist[i];
      var baseSong = getBaseSongById(item.songId);
      if (!baseSong) continue;
      var song = getEffectiveSong(baseSong).song;
      var keyLabel = Transposer.indexToNoteName(item.targetKeyIndex, Transposer.shouldUseFlats(item.targetKeyIndex, state.accidentalPref));
      rows.push(
        '<div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">' +
          '<div class="flex items-center gap-3">' +
            '<span class="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">' + (i + 1) + '</span>' +
            '<div>' +
              '<button type="button" data-action="launch-setlist-song" data-index="' + i + '" class="text-left font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-sky-400 transition">' +
                escapeHtml(song.title) +
              '</button>' +
              '<p class="text-xs text-slate-500 dark:text-slate-400">' + escapeHtml(song.camp) + ' • Target Key: <span class="font-mono-chord font-bold text-indigo-600 dark:text-sky-400">' + escapeHtml(keyLabel) + '</span></p>' +
            '</div>' +
          '</div>' +
          '<div class="flex items-center gap-1.5">' +
            '<button type="button" data-action="launch-setlist-song" data-index="' + i + '" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition">Open in ' + escapeHtml(keyLabel) + '</button>' +
            '<button type="button" data-action="move-setlist-up" data-index="' + i + '" class="px-2 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" title="Move Up">&uarr;</button>' +
            '<button type="button" data-action="move-setlist-down" data-index="' + i + '" class="px-2 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" title="Move Down">&darr;</button>' +
            '<button type="button" data-action="remove-setlist-item" data-index="' + i + '" class="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40" title="Remove">&times;</button>' +
          '</div>' +
        '</div>'
      );
    }
    listEl.innerHTML = rows.join('');
  }

  function renderAll() {
    applyTheme();
    renderNav();
    renderBrowseView();
    renderSongDetailView();
    renderSetlistView();
    updateAutoScrollButton();
  }

  function switchTab(tab, songId, skipHash) {
    if (tab !== 'song') stopAutoScroll();
    state.activeTab = tab;
    if (songId) state.selectedSongId = songId;
    if (!skipHash) {
      var nextHash = tab === 'song' ? '#/song/' + state.selectedSongId : '#/' + tab;
      try {
        if (window.location.hash !== nextHash) {
          window.history.replaceState(null, '', nextHash);
        }
      } catch (e) {
        // Ignore sandbox history restrictions
      }
    }
    renderAll();
    window.scrollTo(0, 0);
  }

  function toggleSongInSetlist(songId) {
    var baseSong = getBaseSongById(songId);
    if (!baseSong) return;
    var eff = getEffectiveSong(baseSong);
    var baseIdx = Transposer.noteNameToIndex(eff.baseKey);
    var currentConcertIdx = Transposer.mod12(baseIdx + getSongTranspose(songId));

    var existingIdx = -1;
    for (var i = 0; i < state.setlist.length; i++) {
      if (state.setlist[i].songId === songId) {
        existingIdx = i;
        break;
      }
    }

    if (existingIdx !== -1) {
      state.setlist.splice(existingIdx, 1);
      safeSave(STORAGE_KEYS.setlist, state.setlist);
      showToast('Removed "' + eff.song.title + '" from Setlist');
    } else {
      state.setlist.push({ songId: songId, targetKeyIndex: currentConcertIdx });
      safeSave(STORAGE_KEYS.setlist, state.setlist);
      showToast('Saved "' + eff.song.title + '" to Setlist');
    }
    renderAll();
  }

  function openChordEditor() {
    var baseSong = getBaseSongById(state.selectedSongId);
    if (!baseSong) return;
    var eff = getEffectiveSong(baseSong);
    var song = eff.song;
    var modal = document.getElementById('editor-modal');
    var titleSpan = document.getElementById('editor-song-title');
    var fnSpan = document.getElementById('editor-md-filename');
    var keySel = document.getElementById('editor-base-key-select');
    var ta = document.getElementById('editor-textarea');
    if (!modal || !ta || !keySel) return;

    if (titleSpan) titleSpan.textContent = song.title;
    if (fnSpan) fnSpan.textContent = song.mdFile;

    var keyOpts = [];
    var currentBaseIdx = Transposer.noteNameToIndex(eff.baseKey);
    for (var i = 0; i < Transposer.KEY_OPTIONS.length; i++) {
      var ko = Transposer.KEY_OPTIONS[i];
      keyOpts.push('<option value="' + ko.label + '"' + (ko.index === currentBaseIdx ? ' selected' : '') + '>' + ko.label + '</option>');
    }
    keySel.innerHTML = keyOpts.join('');
    ta.value = song.rawMarkdown || MDParser.serializeSongMarkdown(song);
    modal.classList.remove('hidden');
  }

  function closeChordEditor() {
    var modal = document.getElementById('editor-modal');
    if (modal) modal.classList.add('hidden');
  }

  function getEditorMarkdownWithSyncedKey() {
    var baseSong = getBaseSongById(state.selectedSongId);
    var keySel = document.getElementById('editor-base-key-select');
    var ta = document.getElementById('editor-textarea');
    if (!baseSong || !ta || !keySel) return '';
    var raw = ta.value;
    var hasChords = raw.replace(/^---[\s\S]*?---/, '').indexOf('[') !== -1;
    return MDParser.updateYamlKeyInRawMd(raw, keySel.value || 'G', hasChords);
  }

  function saveChordEditor() {
    var baseSong = getBaseSongById(state.selectedSongId);
    if (!baseSong) return;
    var updatedMd = getEditorMarkdownWithSyncedKey();
    if (!updatedMd) return;

    state.customMd[baseSong.id] = updatedMd;
    state.transposeMap[baseSong.id] = 0;
    safeSave(STORAGE_KEYS.customMd, state.customMd);
    closeChordEditor();
    renderAll();
    showToast('Saved Markdown + YAML song sheet — transposition active!');
  }

  function resetChordEditor() {
    var baseSong = getBaseSongById(state.selectedSongId);
    if (!baseSong) return;
    delete state.customMd[baseSong.id];
    safeSave(STORAGE_KEYS.customMd, state.customMd);
    closeChordEditor();
    renderAll();
    showToast('Restored archive .md file for "' + baseSong.title + '"');
  }

  function copyMdSongFile() {
    var baseSong = getBaseSongById(state.selectedSongId);
    if (!baseSong) return;
    var mdText = getEditorMarkdownWithSyncedKey();
    copyTextToClipboard(mdText, 'Copied ' + baseSong.mdFile + ' (YAML + Markdown) to clipboard!');
  }

  function downloadCurrentSongMd(fromEditor) {
    var baseSong = getBaseSongById(state.selectedSongId);
    if (!baseSong) return;
    var eff = getEffectiveSong(baseSong);
    var content = fromEditor ? getEditorMarkdownWithSyncedKey() : (eff.song.rawMarkdown || MDParser.serializeSongMarkdown(eff.song));
    var baseName = (eff.song.mdFile || (eff.song.year + '-' + eff.song.id + '.md')).split('/').pop();
    triggerMarkdownDownload(baseName, content);
  }

  function stepAdjacentSong(delta) {
    var filtered = getFilteredSongs();
    var list = filtered.length ? filtered : SONGS;
    var idx = 0;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === state.selectedSongId) {
        idx = i;
        break;
      }
    }
    var nextIdx = (idx + delta + list.length) % list.length;
    switchTab('song', list[nextIdx].id, false);
  }

  function syncFromHash() {
    var h = window.location.hash || '';
    if (h.indexOf('#/song/') === 0) {
      var sid = decodeURIComponent(h.slice(7));
      if (getBaseSongById(sid)) {
        switchTab('song', sid, true);
        return;
      }
    } else if (h === '#/setlist') {
      switchTab('setlist', null, true);
      return;
    } else if (h === '#/deploy') {
      switchTab('deploy', null, true);
      return;
    } else if (h === '#/browse') {
      switchTab('browse', null, true);
      return;
    }
    renderAll();
  }

  function tryHydrateLiveMarkdownFiles() {
    if (IS_CANVAS || !window.fetch) return;
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

  function bindStaticControls() {
    // Top navigation
    document.getElementById('nav-browse-btn').addEventListener('click', function () { switchTab('browse'); });
    document.getElementById('nav-song-btn').addEventListener('click', function () { switchTab('song', state.selectedSongId); });
    document.getElementById('nav-setlist-btn').addEventListener('click', function () { switchTab('setlist'); });
    document.getElementById('nav-deploy-btn').addEventListener('click', function () { switchTab('deploy'); });

    document.getElementById('theme-toggle-btn').addEventListener('click', function () {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      safeSave(STORAGE_KEYS.theme, state.theme);
      applyTheme();
      showToast(state.theme === 'dark' ? 'Stage Dark Mode enabled' : 'Paper Light Mode enabled');
    });

    // Browse filters & Sort By
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

    document.getElementById('era-filter-select').addEventListener('change', function (e) {
      state.eraFilter = e.target.value;
      renderBrowseView();
    });

    document.getElementById('lang-filter-select').addEventListener('change', function (e) {
      state.langFilter = e.target.value;
      renderBrowseView();
    });

    document.getElementById('media-filter-select').addEventListener('change', function (e) {
      state.mediaFilter = e.target.value;
      renderBrowseView();
    });

    document.getElementById('sort-select').addEventListener('change', function (e) {
      state.sortBy = e.target.value;
      renderBrowseView();
    });

    document.getElementById('reset-filters-btn').addEventListener('click', function () {
      state.searchQuery = '';
      state.eraFilter = 'all';
      state.langFilter = 'all';
      state.mediaFilter = 'all';
      state.sortBy = 'newest';
      searchInput.value = '';
      document.getElementById('era-filter-select').value = 'all';
      document.getElementById('lang-filter-select').value = 'all';
      document.getElementById('media-filter-select').value = 'all';
      document.getElementById('sort-select').value = 'newest';
      renderBrowseView();
    });

    document.getElementById('copy-browse-contact-btn').addEventListener('click', function () {
      copyTextToClipboard(CONTACT_EMAIL, 'Copied ' + CONTACT_EMAIL + ' to clipboard!');
    });

    document.getElementById('copy-deploy-contact-btn').addEventListener('click', function () {
      copyTextToClipboard(CONTACT_EMAIL, 'Copied ' + CONTACT_EMAIL + ' to clipboard!');
    });

    // Song Detail controls
    document.getElementById('back-to-browse-btn').addEventListener('click', function () { switchTab('browse'); });
    document.getElementById('prev-song-btn').addEventListener('click', function () { stepAdjacentSong(-1); });
    document.getElementById('next-song-btn').addEventListener('click', function () { stepAdjacentSong(1); });
    document.getElementById('toggle-setlist-current-btn').addEventListener('click', function () {
      toggleSongInSetlist(state.selectedSongId);
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
      showToast('Reset to original base key');
    });

    document.getElementById('target-key-select').addEventListener('change', function (e) {
      var baseSong = getBaseSongById(state.selectedSongId);
      if (!baseSong) return;
      var eff = getEffectiveSong(baseSong);
      var baseIdx = Transposer.noteNameToIndex(eff.baseKey);
      var desiredIdx = Number(e.target.value);
      var diff = desiredIdx - baseIdx;
      if (diff > 6) diff -= 12;
      if (diff < -6) diff += 12;
      state.transposeMap[baseSong.id] = diff;
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
      state.fontScale = Math.min(1.45, Math.round((state.fontScale + 0.1) * 100) / 100);
      renderSongDetailView();
    });

    document.getElementById('two-col-btn').addEventListener('click', function () {
      state.twoColumn = !state.twoColumn;
      renderSongDetailView();
    });

    document.getElementById('autoscroll-btn').addEventListener('click', cycleAutoScroll);

    document.getElementById('download-song-md-btn').addEventListener('click', function () {
      downloadCurrentSongMd(false);
    });

    document.getElementById('copy-sheet-btn').addEventListener('click', function () {
      var baseSong = getBaseSongById(state.selectedSongId);
      if (!baseSong) return;
      var eff = getEffectiveSong(baseSong);
      var baseIdx = Transposer.noteNameToIndex(eff.baseKey);
      var concertIdx = Transposer.mod12(baseIdx + getSongTranspose(baseSong.id));
      var capo = getSongCapo(baseSong.id);
      var shapedIdx = Transposer.mod12(concertIdx - capo);
      var plain = Transposer.renderPlainTextSheet(eff.song, eff.sections, {
        baseKeyIndex: baseIdx,
        concertKeyIndex: concertIdx,
        targetKeyIndex: shapedIdx,
        notationMode: state.notationMode,
        accidentalPref: state.accidentalPref,
        capo: capo
      });
      copyTextToClipboard(plain, 'Copied "' + eff.song.title + '" sheet to clipboard!');
    });

    document.getElementById('print-sheet-btn').addEventListener('click', function () {
      window.print();
    });

    // Editor Modal controls
    document.getElementById('open-editor-btn').addEventListener('click', openChordEditor);
    document.getElementById('close-editor-btn').addEventListener('click', closeChordEditor);
    document.getElementById('save-editor-btn').addEventListener('click', saveChordEditor);
    document.getElementById('reset-editor-btn').addEventListener('click', resetChordEditor);
    document.getElementById('copy-js-entry-btn').addEventListener('click', copyMdSongFile);
    document.getElementById('download-editor-md-btn').addEventListener('click', function () {
      downloadCurrentSongMd(true);
    });
    document.getElementById('editor-base-key-select').addEventListener('change', function (e) {
      var ta = document.getElementById('editor-textarea');
      if (ta) {
        var hasCh = ta.value.replace(/^---[\s\S]*?---/, '').indexOf('[') !== -1;
        ta.value = MDParser.updateYamlKeyInRawMd(ta.value, e.target.value, hasCh);
      }
    });

    // Setlist controls
    document.getElementById('clear-setlist-btn').addEventListener('click', function () {
      state.setlist = [];
      safeSave(STORAGE_KEYS.setlist, state.setlist);
      renderAll();
      showToast('Cleared setlist');
    });

    document.getElementById('copy-setlist-btn').addEventListener('click', function () {
      if (!state.setlist.length) {
        showToast('Setlist is currently empty');
        return;
      }
      var lines = ['SOUNDS OF JOY — WORSHIP SETLIST', '================================'];
      for (var i = 0; i < state.setlist.length; i++) {
        var it = state.setlist[i];
        var bs = getBaseSongById(it.songId);
        if (!bs) continue;
        var s = getEffectiveSong(bs).song;
        var kName = Transposer.indexToNoteName(it.targetKeyIndex, Transposer.shouldUseFlats(it.targetKeyIndex, state.accidentalPref));
        lines.push((i + 1) + '. ' + s.title + ' (Key: ' + kName + ') — ' + s.camp);
      }
      copyTextToClipboard(lines.join('\n'), 'Copied worship setlist to clipboard!');
    });

    // Deploy commands copy
    document.getElementById('copy-git-cmds-btn').addEventListener('click', function () {
      var cmds = [
        'npm run build',
        'git add .',
        'git commit -m "Update POJ songbook"',
        'git push origin main'
      ].join('\n');
      copyTextToClipboard(cmds, 'Copied GitHub sync commands!');
    });

    // Delegated click handling for dynamic cards, quick-sort pills, banners, and setlist rows
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      if (action === 'open-song') {
        var sid = btn.getAttribute('data-song-id');
        switchTab('song', sid, false);
      } else if (action === 'quick-sort') {
        var nextSort = btn.getAttribute('data-sort') || 'newest';
        state.sortBy = nextSort;
        renderBrowseView();
      } else if (action === 'copy-contact-email') {
        copyTextToClipboard(CONTACT_EMAIL, 'Copied ' + CONTACT_EMAIL + ' to clipboard!');
      } else if (action === 'toggle-setlist') {
        e.stopPropagation();
        toggleSongInSetlist(btn.getAttribute('data-song-id'));
      } else if (action === 'open-editor') {
        openChordEditor();
      } else if (action === 'launch-setlist-song') {
        var idx = Number(btn.getAttribute('data-index'));
        var item = state.setlist[idx];
        if (!item) return;
        var bs = getBaseSongById(item.songId);
        if (!bs) return;
        var eff = getEffectiveSong(bs);
        var baseIdx = Transposer.noteNameToIndex(eff.baseKey);
        var diff = item.targetKeyIndex - baseIdx;
        if (diff > 6) diff -= 12;
        if (diff < -6) diff += 12;
        state.transposeMap[bs.id] = diff;
        switchTab('song', bs.id, false);
      } else if (action === 'move-setlist-up') {
        var uIdx = Number(btn.getAttribute('data-index'));
        if (uIdx > 0) {
          var tmpU = state.setlist[uIdx - 1];
          state.setlist[uIdx - 1] = state.setlist[uIdx];
          state.setlist[uIdx] = tmpU;
          safeSave(STORAGE_KEYS.setlist, state.setlist);
          renderSetlistView();
        }
      } else if (action === 'move-setlist-down') {
        var dIdx = Number(btn.getAttribute('data-index'));
        if (dIdx < state.setlist.length - 1) {
          var tmpD = state.setlist[dIdx + 1];
          state.setlist[dIdx + 1] = state.setlist[dIdx];
          state.setlist[dIdx] = tmpD;
          safeSave(STORAGE_KEYS.setlist, state.setlist);
          renderSetlistView();
        }
      } else if (action === 'remove-setlist-item') {
        var rIdx = Number(btn.getAttribute('data-index'));
        state.setlist.splice(rIdx, 1);
        safeSave(STORAGE_KEYS.setlist, state.setlist);
        renderAll();
      }
    });

    window.addEventListener('hashchange', syncFromHash);
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindStaticControls();
    syncFromHash();
    tryHydrateLiveMarkdownFiles();
  });
})();
