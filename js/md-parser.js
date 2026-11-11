/**
 * Sounds of Joy — Universal Markdown + YAML Frontmatter Song Parser & Serializer
 * Works identically in Node.js (scripts/build-songbook.js) and in the browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SOJMarkdown = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  function unquoteYaml(val) {
    var s = String(val == null ? '' : val).trim();
    if (!s || s === '[]') return '';
    if ((s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') ||
        (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'")) {
      var inner = s.slice(1, -1);
      if (s.charAt(0) === '"') {
        inner = inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
      return inner;
    }
    return s;
  }

  function quoteYaml(val) {
    var s = String(val == null ? '' : val).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return '"' + s + '"';
  }

  function parseYamlFrontmatter(yamlText) {
    var meta = {
      audio_files: [],
      drive_links: []
    };
    var lines = String(yamlText || '').replace(/\r\n/g, '\n').split('\n');
    var currentListKey = null;
    var currentObj = null;

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      if (!raw.trim() || /^\s*#/.test(raw)) continue;

      // Top-level key: value
      var topMatch = /^([a-zA-Z0-9_]+)\s*:\s*(.*)$/.exec(raw);
      if (topMatch) {
        currentObj = null;
        var key = topMatch[1];
        var val = topMatch[2].trim();
        if (val === '[]') {
          meta[key] = [];
          currentListKey = null;
        } else if (val === '') {
          meta[key] = [];
          currentListKey = key;
        } else if (val === 'true') {
          meta[key] = true;
          currentListKey = null;
        } else if (val === 'false') {
          meta[key] = false;
          currentListKey = null;
        } else if (/^-?\d+$/.test(val)) {
          meta[key] = parseInt(val, 10);
          currentListKey = null;
        } else {
          meta[key] = unquoteYaml(val);
          currentListKey = null;
        }
        continue;
      }

      // List item start: "  - prop: val"
      var itemStart = /^\s+-\s+([a-zA-Z0-9_]+)\s*:\s*(.*)$/.exec(raw);
      if (itemStart && currentListKey) {
        currentObj = {};
        currentObj[itemStart[1]] = unquoteYaml(itemStart[2]);
        if (!Array.isArray(meta[currentListKey])) meta[currentListKey] = [];
        meta[currentListKey].push(currentObj);
        continue;
      }

      // Continuation property on list item: "    prop: val"
      var itemProp = /^\s{3,}([a-zA-Z0-9_]+)\s*:\s*(.*)$/.exec(raw);
      if (itemProp && currentObj) {
        currentObj[itemProp[1]] = unquoteYaml(itemProp[2]);
      }
    }

    return meta;
  }

  function parseMarkdownSections(bodyText) {
    var lines = String(bodyText || '').replace(/\r\n/g, '\n').split('\n');
    var sections = [];
    var current = null;

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var hMatch = /^##\s+(.+)$/.exec(raw) || /^\s*\{([^}]+)\}\s*$/.exec(raw);
      if (hMatch) {
        if (current) sections.push(current);
        var label = hMatch[1].trim();
        current = {
          label: label,
          instrumental: /^(intro|interlude|outro|instrumental)/i.test(label),
          explicitInstrumental: false,
          progression: '',
          lines: []
        };
        continue;
      }

      var progMatch = /^>\s*Progression\s*:\s*(.+)$/i.exec(raw);
      if (progMatch && current) {
        current.progression = progMatch[1].trim();
        continue;
      }

      var instMatch = /^>\s*Instrumental\s*:\s*(true|false)\s*$/i.exec(raw);
      if (instMatch && current) {
        current.instrumental = instMatch[1].toLowerCase() === 'true';
        current.explicitInstrumental = true;
        continue;
      }

      if (!current) {
        if (!raw.trim()) continue;
        current = {
          label: 'Verse 1',
          instrumental: false,
          progression: '',
          lines: []
        };
      }
      current.lines.push(raw.replace(/(?: {2,}|\\|<br\s*\/?>)\s*$/i, ''));
    }
    if (current) sections.push(current);

    for (var s = 0; s < sections.length; s++) {
      var arr = sections[s].lines;
      while (arr.length && arr[0].trim() === '') arr.shift();
      while (arr.length && arr[arr.length - 1].trim() === '') arr.pop();
      if (!sections[s].explicitInstrumental) {
        var hasWords = false;
        for (var w = 0; w < arr.length; w++) {
          if (arr[w].replace(/\[[^\]]+\]/g, '').trim() !== '') {
            hasWords = true;
            break;
          }
        }
        if (hasWords && sections[s].instrumental) {
          sections[s].instrumental = false;
        } else if (!hasWords && arr.length > 0) {
          sections[s].instrumental = true;
        }
      }
      delete sections[s].explicitInstrumental;
    }

    return sections;
  }

  function parseSongMarkdown(rawMd, filePath) {
    var text = String(rawMd || '').replace(/\r\n/g, '\n');
    var yamlPart = '';
    var bodyPart = text;

    var fmMatch = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
    if (fmMatch) {
      yamlPart = fmMatch[1];
      bodyPart = fmMatch[2];
    }

    var meta = parseYamlFrontmatter(yamlPart);
    var sections = parseMarkdownSections(bodyPart);

    var audioFiles = Array.isArray(meta.audio_files) ? meta.audio_files.map(function (a) {
      return {
        label: a.label || 'Audio Recording',
        path: a.path || '',
        driveUrl: a.drive_url || a.driveUrl || ''
      };
    }) : [];

    var driveLinks = Array.isArray(meta.drive_links) ? meta.drive_links.map(function (d) {
      return {
        label: d.label || 'Google Drive Source',
        url: d.url || ''
      };
    }) : [];

    var id = meta.id || 'untitled-song';
    var year = typeof meta.year === 'number' ? meta.year : (parseInt(meta.year, 10) || 2026);
    var mdPath = filePath || ('songs/' + year + '-' + id + '.md');

    return {
      id: id,
      mdFile: mdPath,
      rawMarkdown: text,
      title: meta.title || id,
      year: year,
      camp: meta.camp || '',
      language: meta.language || 'English',
      scripture: meta.scripture || '',
      writers: meta.credits || meta.writers || '',
      credits: meta.credits || meta.writers || '',
      lyricists: meta.lyricists || '',
      composers: meta.composers || '',
      performers: meta.performers || '',
      creditNote: meta.credit_note || '',
      baseKey: meta.key || 'G',
      keyVerified: Boolean(meta.key_verified),
      keyNote: meta.key_note || '',
      chordStatus: meta.chord_status || 'lyrics-archived',
      youtubeUrl: meta.youtube_url || '',
      contact: meta.contact || 'arian.prabowo@placeofjoy.org.au',
      audioFiles: audioFiles,
      driveLinks: driveLinks,
      sections: sections
    };
  }

  function serializeSongMarkdown(song) {
    var lines = ['---'];
    lines.push('id: ' + quoteYaml(song.id || 'song'));
    lines.push('title: ' + quoteYaml(song.title || 'Untitled'));
    lines.push('year: ' + (song.year || 2026));
    lines.push('camp: ' + quoteYaml(song.camp || ''));
    lines.push('language: ' + quoteYaml(song.language || 'English'));
    lines.push('scripture: ' + quoteYaml(song.scripture || ''));
    lines.push('credits: ' + quoteYaml(song.credits || song.writers || ''));
    lines.push('lyricists: ' + quoteYaml(song.lyricists || ''));
    lines.push('composers: ' + quoteYaml(song.composers || ''));
    lines.push('performers: ' + quoteYaml(song.performers || ''));
    lines.push('credit_note: ' + quoteYaml(song.creditNote || ''));
    lines.push('key: ' + quoteYaml(song.baseKey || 'G'));
    lines.push('key_verified: ' + (song.keyVerified ? 'true' : 'false'));
    lines.push('key_note: ' + quoteYaml(song.keyNote || ''));
    lines.push('chord_status: ' + quoteYaml(song.chordStatus || 'lyrics-archived'));
    lines.push('youtube_url: ' + quoteYaml(song.youtubeUrl || ''));
    lines.push('contact: ' + quoteYaml(song.contact || 'arian.prabowo@placeofjoy.org.au'));

    var af = song.audioFiles || [];
    if (af.length) {
      lines.push('audio_files:');
      for (var i = 0; i < af.length; i++) {
        lines.push('  - label: ' + quoteYaml(af[i].label || ''));
        lines.push('    path: ' + quoteYaml(af[i].path || ''));
        lines.push('    drive_url: ' + quoteYaml(af[i].driveUrl || af[i].drive_url || ''));
      }
    } else {
      lines.push('audio_files: []');
    }

    var dl = song.driveLinks || [];
    if (dl.length) {
      lines.push('drive_links:');
      for (var j = 0; j < dl.length; j++) {
        lines.push('  - label: ' + quoteYaml(dl[j].label || ''));
        lines.push('    url: ' + quoteYaml(dl[j].url || ''));
      }
    } else {
      lines.push('drive_links: []');
    }

    lines.push('---');
    lines.push('');

    var secs = song.sections || [];
    for (var s = 0; s < secs.length; s++) {
      var sec = secs[s];
      lines.push('## ' + (sec.label || 'Verse'));
      if (sec.progression) {
        lines.push('> Progression: ' + sec.progression);
        lines.push('');
      }
      var sLines = sec.lines || [];
      for (var l = 0; l < sLines.length; l++) {
        var cleanLine = String(sLines[l] || '').replace(/(?: {2,}|\\|<br\s*\/?>)\s*$/i, '');
        var nextHasText = l + 1 < sLines.length && String(sLines[l + 1] || '').trim() !== '';
        lines.push(cleanLine.trim() !== '' && nextHasText ? cleanLine + '  ' : cleanLine);
      }
      lines.push('');
    }

    return lines.join('\n').replace(/\s+$/, '') + '\n';
  }

  function updateYamlKeyInRawMd(rawMd, newKey, hasChords) {
    var text = String(rawMd || '');
    if (/^---\n[\s\S]*?\n---/.test(text)) {
      text = text.replace(/^(key\s*:\s*).*$/m, '$1' + quoteYaml(newKey));
      text = text.replace(/^(key_verified\s*:\s*).*$/m, '$1true');
      if (hasChords) {
        text = text.replace(/^(chord_status\s*:\s*).*$/m, '$1"chords-archived"');
      }
      return text;
    }
    return text;
  }

  return {
    parseSongMarkdown: parseSongMarkdown,
    serializeSongMarkdown: serializeSongMarkdown,
    updateYamlKeyInRawMd: updateYamlKeyInRawMd
  };
});
