/**
 * Sounds of Joy — Chromatic & Nashville Chord Transposition Engine
 * Supports:
 * - Nashville Number System tokens: 1, 1/3, 2m, 3m, 3M, 4, 4m, 4#dim, #4dim, 5, 6m, b7, 6#
 * - Standard Letter Chords: C, C#/Db, Dm7, E/G#, F#m7b5, Cadd9, Bb/D, etc.
 * - Enharmonic spelling ('auto' key-signature aware, 'sharp', or 'flat')
 * - Capo shape calculation & bidirectional Letter <-> Nashville rendering
 */

(function () {
  var NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var NOTES_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  var KEY_OPTIONS = [
    { index: 0,  label: 'C',  preferFlat: false },
    { index: 1,  label: 'Db', preferFlat: true  },
    { index: 2,  label: 'D',  preferFlat: false },
    { index: 3,  label: 'Eb', preferFlat: true  },
    { index: 4,  label: 'E',  preferFlat: false },
    { index: 5,  label: 'F',  preferFlat: true  },
    { index: 6,  label: 'F#', preferFlat: false },
    { index: 7,  label: 'G',  preferFlat: false },
    { index: 8,  label: 'Ab', preferFlat: true  },
    { index: 9,  label: 'A',  preferFlat: false },
    { index: 10, label: 'Bb', preferFlat: true  },
    { index: 11, label: 'B',  preferFlat: false }
  ];

  var NOTE_TO_INDEX = {
    'C': 0,  'B#': 0,
    'C#': 1, 'Db': 1,
    'D': 2,
    'D#': 3, 'Eb': 3,
    'E': 4,  'Fb': 4,
    'F': 5,  'E#': 5,
    'F#': 6, 'Gb': 6,
    'G': 7,
    'G#': 8, 'Ab': 8,
    'A': 9,
    'A#': 10, 'Bb': 10,
    'B': 11, 'Cb': 11
  };

  // Major scale degree -> semitones above tonic (0..11)
  var DEGREE_SEMITONES = {
    '1': 0,
    '#1': 1, '1#': 1, 'b2': 1,
    '2': 2,
    '#2': 3, '2#': 3, 'b3': 3,
    '3': 4,
    '4': 5,
    '#4': 6, '4#': 6, 'b5': 6,
    '5': 7,
    '#5': 8, '5#': 8, 'b6': 8,
    '6': 9,
    '#6': 10, '6#': 10, 'b7': 10,
    '7': 11
  };

  var SEMITONE_TO_DEGREE_FLAT = ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'];

  function mod12(n) {
    return ((n % 12) + 12) % 12;
  }

  function noteNameToIndex(note) {
    if (!note) return 0;
    var clean = String(note).trim();
    if (Object.prototype.hasOwnProperty.call(NOTE_TO_INDEX, clean)) {
      return NOTE_TO_INDEX[clean];
    }
    var head = clean.charAt(0).toUpperCase() + (clean.charAt(1) === '#' || clean.charAt(1) === 'b' ? clean.charAt(1) : '');
    return Object.prototype.hasOwnProperty.call(NOTE_TO_INDEX, head) ? NOTE_TO_INDEX[head] : 0;
  }

  function shouldUseFlats(keyIndex, accidentalPref) {
    if (accidentalPref === 'sharp') return false;
    if (accidentalPref === 'flat') return true;
    var k = mod12(keyIndex);
    // Flat keys: Db(1), Eb(3), F(5), Ab(8), Bb(10)
    return k === 1 || k === 3 || k === 5 || k === 8 || k === 10;
  }

  function indexToNoteName(index, useFlats) {
    var i = mod12(index);
    return useFlats ? NOTES_FLAT[i] : NOTES_SHARP[i];
  }

  /**
   * Parses a single Nashville degree token (without slash), e.g.:
   * "1", "2m", "3M", "4#dim", "#4dim", "b7", "6m7"
   */
  function parseNashvillePart(part) {
    var m = /^([b#]?[1-7][#]?)(.*)$/.exec(part.trim());
    if (!m) return null;
    var degToken = m[1];
    var suffix = m[2] || '';
    if (!Object.prototype.hasOwnProperty.call(DEGREE_SEMITONES, degToken)) {
      return null;
    }
    return {
      isNashville: true,
      semitoneOffset: DEGREE_SEMITONES[degToken],
      degreeToken: degToken,
      suffix: suffix
    };
  }

  /**
   * Parses a single letter chord part (without slash), e.g.:
   * "C", "F#m7", "Bbadd9", "G#dim"
   */
  function parseLetterPart(part) {
    var m = /^([A-G][#b]?)(.*)$/.exec(part.trim());
    if (!m) return null;
    var root = m[1];
    var suffix = m[2] || '';
    if (!Object.prototype.hasOwnProperty.call(NOTE_TO_INDEX, root)) {
      return null;
    }
    return {
      isNashville: false,
      noteIndex: NOTE_TO_INDEX[root],
      root: root,
      suffix: suffix
    };
  }

  function normalizeLetterSuffix(suffix) {
    // In Nashville notation "3M" denotes Major III; in letter chords "E" not "EM"
    if (suffix === 'M') return '';
    return suffix;
  }

  function normalizeNashvilleSuffix(suffix, degSemitone) {
    if (!suffix) {
      // Natural diatonic minor degrees in major key won't carry 'm' unless written,
      // so if converting from letter chord 'E' in key of C (semitone 4), mark '3M'
      if (degSemitone === 4 || degSemitone === 9 || degSemitone === 2) {
        return 'M';
      }
      return '';
    }
    return suffix;
  }

  /**
   * Format a single chord token (supporting slash chords like "1/3" or "D/F#")
   * @param {string} rawToken - e.g. "1/3", "4#dim", "G/B", "F#m7"
   * @param {object} opts - { baseKeyIndex, targetKeyIndex, notationMode, accidentalPref }
   */
  function formatChordToken(rawToken, opts) {
    if (!rawToken) return '';
    var trimmed = String(rawToken).trim();
    if (!trimmed) return '';

    // Preserve structural markers like "|", "||", "(x2)"
    if (trimmed === '|' || trimmed === '||' || /^\(x\d+\)$/i.test(trimmed)) {
      return trimmed;
    }

    var baseKeyIndex = mod12(opts.baseKeyIndex || 0);
    var targetKeyIndex = mod12(opts.targetKeyIndex || 0);
    var shift = mod12(targetKeyIndex - baseKeyIndex);
    var useFlats = shouldUseFlats(targetKeyIndex, opts.accidentalPref || 'auto');
    var mode = opts.notationMode || 'chords';

    var slashParts = trimmed.split('/');
    var mainRaw = slashParts[0];
    var bassRaw = slashParts.length > 1 ? slashParts[1] : null;

    var nMain = parseNashvillePart(mainRaw);
    if (nMain) {
      var nBass = bassRaw ? parseNashvillePart(bassRaw) : null;
      if (mode === 'nashville') {
        var normDeg = nMain.degreeToken === '6#' ? 'b7' : (nMain.degreeToken === '4#' ? '#4' : nMain.degreeToken);
        var outN = normDeg + nMain.suffix;
        if (nBass) {
          var normBass = nBass.degreeToken === '6#' ? 'b7' : nBass.degreeToken;
          outN += '/' + normBass + (nBass.suffix || '');
        } else if (bassRaw) {
          outN += '/' + bassRaw;
        }
        return outN;
      }
      // Convert Nashville -> Letter chord in targetKeyIndex
      var mainNoteIdx = mod12(targetKeyIndex + nMain.semitoneOffset);
      // Borrowed b7 or 4m in sharp keys: spell b7 naturally (e.g. D in E, F in G, C in D)
      var mainFlat = useFlats || /^b/.test(nMain.degreeToken);
      if (nMain.degreeToken === '4#' || nMain.degreeToken === '#4') mainFlat = false;
      var mainRoot = indexToNoteName(mainNoteIdx, mainFlat);
      var outLetter = mainRoot + normalizeLetterSuffix(nMain.suffix);
      if (nBass) {
        var bassIdx = mod12(targetKeyIndex + nBass.semitoneOffset);
        var bassFlat = useFlats || /^b/.test(nBass.degreeToken);
        outLetter += '/' + indexToNoteName(bassIdx, bassFlat);
      } else if (bassRaw) {
        outLetter += '/' + bassRaw;
      }
      return outLetter;
    }

    var lMain = parseLetterPart(mainRaw);
    if (lMain) {
      var lBass = bassRaw ? parseLetterPart(bassRaw) : null;
      var shiftedMainIdx = mod12(lMain.noteIndex + shift);
      if (mode === 'nashville') {
        var relMain = mod12(shiftedMainIdx - targetKeyIndex);
        var degStr = SEMITONE_TO_DEGREE_FLAT[relMain];
        var nSuf = normalizeNashvilleSuffix(lMain.suffix, relMain);
        var resN = degStr + nSuf;
        if (lBass) {
          var shiftedBassIdx = mod12(lBass.noteIndex + shift);
          var relBass = mod12(shiftedBassIdx - targetKeyIndex);
          resN += '/' + SEMITONE_TO_DEGREE_FLAT[relBass];
        } else if (bassRaw) {
          resN += '/' + bassRaw;
        }
        return resN;
      }
      var resLetter = indexToNoteName(shiftedMainIdx, useFlats) + lMain.suffix;
      if (lBass) {
        var sBass = mod12(lBass.noteIndex + shift);
        resLetter += '/' + indexToNoteName(sBass, useFlats);
      } else if (bassRaw) {
        resLetter += '/' + bassRaw;
      }
      return resLetter;
    }

    return trimmed;
  }

  /**
   * Transposes a freeform progression string such as:
   * "1  2m  4  |  6m  5  4"
   */
  function formatProgressionBar(progressionStr, opts) {
    if (!progressionStr) return [];
    var rawTokens = String(progressionStr).trim().split(/\s+/);
    var output = [];
    for (var i = 0; i < rawTokens.length; i++) {
      var tok = rawTokens[i];
      if (!tok) continue;
      if (tok === '|' || tok === '||') {
        output.push({ type: 'sep', text: tok });
      } else {
        output.push({ type: 'chord', text: formatChordToken(tok, opts) });
      }
    }
    return output;
  }

  /**
   * Parses a ChordPro line like:
   * "[1]Here is my [4]broken heart"
   * into an array of { chord, lyric } segments.
   */
  function parseChordProLine(line, opts) {
    var str = String(line || '');
    if (str.indexOf('[') === -1) {
      return { hasChords: false, segments: [{ chord: '', lyric: str }] };
    }
    var regex = /\[([^\]]+)\]([^\[]*)/g;
    var segments = [];
    var firstBracket = str.indexOf('[');
    if (firstBracket > 0) {
      segments.push({ chord: '', lyric: str.slice(0, firstBracket) });
    }
    var match;
    while ((match = regex.exec(str)) !== null) {
      var formattedChord = formatChordToken(match[1], opts);
      segments.push({
        chord: formattedChord,
        lyric: match[2] || ''
      });
    }
    return { hasChords: true, segments: segments };
  }

  /**
   * Converts a song object's sections to editable ChordPro text
   */
  function sectionsToChordPro(sections) {
    if (!sections || !sections.length) return '';
    var blocks = [];
    for (var i = 0; i < sections.length; i++) {
      var sec = sections[i];
      var header = '{' + (sec.label || 'Section') + '}';
      var lines = (sec.lines || []).join('\n');
      blocks.push(header + '\n' + lines);
    }
    return blocks.join('\n\n');
  }

  /**
   * Parses user-edited ChordPro text back into section objects
   */
  function chordProToSections(chordProText) {
    var lines = String(chordProText || '').replace(/\r\n/g, '\n').split('\n');
    var sections = [];
    var current = null;

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var secMatch = /^\s*\{([^}]+)\}\s*$/.exec(raw) || /^\s*\[((?:Intro|Verse|Pre-Chorus|Chorus|Post-Chorus|Bridge|Interlude|Coda|Outro|Tag)[^\]]*)\]\s*$/i.exec(raw);
      if (secMatch) {
        if (current) sections.push(current);
        var label = secMatch[1].trim();
        current = {
          label: label,
          instrumental: /^(intro|interlude|outro|instrumental)/i.test(label),
          lines: []
        };
      } else {
        if (!current) {
          current = { label: 'Verse 1', instrumental: false, lines: [] };
        }
        current.lines.push(raw);
      }
    }
    if (current) sections.push(current);

    // Trim leading/trailing blank lines inside each section
    for (var s = 0; s < sections.length; s++) {
      var arr = sections[s].lines;
      while (arr.length && arr[0].trim() === '') arr.shift();
      while (arr.length && arr[arr.length - 1].trim() === '') arr.pop();
    }
    return sections;
  }

  /**
   * Renders a plain-text aligned chord + lyric sheet for clipboard copying
   */
  function renderPlainTextSheet(song, sections, opts) {
    var out = [];
    var concertKeyName = indexToNoteName(opts.concertKeyIndex, shouldUseFlats(opts.concertKeyIndex, opts.accidentalPref));
    var shapeKeyName = indexToNoteName(opts.targetKeyIndex, shouldUseFlats(opts.targetKeyIndex, opts.accidentalPref));
    out.push(song.title.toUpperCase() + ' — Sounds of Joy (POJ Melbourne)');
    var metaParts = [song.camp];
    if (opts.notationMode === 'nashville') {
      metaParts.push('Notation: Nashville Numbers');
    } else if (opts.notationMode === 'chords') {
      if (opts.capo > 0) {
        metaParts.push('Concert Key: ' + concertKeyName + ' (Capo ' + opts.capo + ' -> Play ' + shapeKeyName + ')');
      } else {
        metaParts.push('Key: ' + concertKeyName);
      }
    }
    if (song.writers) metaParts.push(song.writers);
    out.push(metaParts.join(' | '));
    out.push('------------------------------------------------------------');
    out.push('');

    for (var i = 0; i < sections.length; i++) {
      var sec = sections[i];
      if (opts.notationMode === 'lyrics' && sec.instrumental) continue;
      out.push('[' + sec.label + ']');
      if (sec.progression && opts.notationMode !== 'lyrics') {
        var pTokens = formatProgressionBar(sec.progression, opts).map(function (t) { return t.text; }).join(' ');
        out.push('Progression: ' + pTokens);
      }
      var secLines = sec.lines || [];
      for (var j = 0; j < secLines.length; j++) {
        var ln = secLines[j];
        if (!ln.trim()) {
          out.push('');
          continue;
        }
        var parsed = parseChordProLine(ln, opts);
        if (!parsed.hasChords || opts.notationMode === 'lyrics') {
          var lyricOnly = parsed.segments.map(function (seg) { return seg.lyric; }).join('');
          if (lyricOnly.trim()) out.push(lyricOnly);
        } else {
          var chordRow = '';
          var lyricRow = '';
          for (var k = 0; k < parsed.segments.length; k++) {
            var seg = parsed.segments[k];
            var c = seg.chord || '';
            var l = seg.lyric || '';
            var width = Math.max(c.length + (c ? 1 : 0), l.length);
            chordRow += c + new Array(Math.max(0, width - c.length) + 1).join(' ');
            lyricRow += l + new Array(Math.max(0, width - l.length) + 1).join(' ');
          }
          if (chordRow.trim()) out.push(chordRow.replace(/\s+$/, ''));
          if (lyricRow.trim()) out.push(lyricRow.replace(/\s+$/, ''));
        }
      }
      out.push('');
    }
    return out.join('\n').trim() + '\n';
  }

  window.SOJTransposer = {
    KEY_OPTIONS: KEY_OPTIONS,
    mod12: mod12,
    noteNameToIndex: noteNameToIndex,
    indexToNoteName: indexToNoteName,
    shouldUseFlats: shouldUseFlats,
    formatChordToken: formatChordToken,
    formatProgressionBar: formatProgressionBar,
    parseChordProLine: parseChordProLine,
    sectionsToChordPro: sectionsToChordPro,
    chordProToSections: chordProToSections,
    renderPlainTextSheet: renderPlainTextSheet
  };
})();
