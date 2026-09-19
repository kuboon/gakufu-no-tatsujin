/**
 * The MML reader.
 *
 * Songs arrive written in a small MML dialect — note letters, lengths, octave shifts, repeats —
 * which is how the melodies are authored and verified before they reach the game. This module is
 * the only place that knows that notation; everything downstream sees the same {@link Note} list
 * the rest of the game already speaks.
 *
 * A melody may be written in several parts, separated by `,`. The parts all start at the top of the
 * song and run together, which is how a chord is written: one voice per line of the harmony. They
 * are merged into the one time-ordered note list the game plays, because a chord is not a special
 * case downstream — two notes that fall on the same beat are two notes to hit.
 *
 * What the dialect carries and the game cannot use is dropped on purpose. Volume, gate time and
 * waveform describe a synthesizer voice, and the game brings its own; a bar line is a reading aid
 * that playback ignores. The reader still parses all of it, so a song can be pasted in unchanged.
 */

import { type Note, noteShape } from "./music.ts";

/**
 * How long the notation may grow once its repeats are written out.
 *
 * Melodies arrive from a URL now, so `[c]999999999` is something a stranger can hand you. The cap
 * is far above any melody anyone writes and far below what would cost the reader anything.
 */
const MAX_LENGTH = 20_000;

/** Letters `c`–`b`, in semitones above C. */
const LETTER_SEMITONES: Record<string, number> = {
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  b: 11,
};

const DEFAULT_TEMPO = 120;
const DEFAULT_LENGTH = 4;
const DEFAULT_OCTAVE = 4;

/** A melody read out of MML. */
export interface Melody {
  notes: Note[];
  /** How many bars the melody covers. A melody that stops mid-bar still occupies the whole bar. */
  bars: number;
  /** From the `t` command — a quarter note per beat, so this is the song's BPM. */
  bpm: number;
  /**
   * Beats of rest inserted in front of the melody so its bar lines land on the grid.
   *
   * A song that starts before the first downbeat — `ハッピーバースデー` does — is written with a
   * short first bar. The reader reads that bar's length from the first bar line and pushes the
   * melody back by the difference, which is where the notes belong on a staff anyway.
   */
  pickup: number;
}

/**
 * Reads a melody written in MML.
 *
 * @param mml The song, e.g. `"t120 l4 o4 | c d e f | e d c2"`. Upper case reads the same.
 * @param beatsPerBar The time signature's beats — MML carries no time signature
 * @returns The notes, in beats from the first downbeat of bar 1
 */
export function readMml(mml: string, beatsPerBar: number): Melody {
  // Case means nothing in this notation, and a melody typed into a URL bar arrives in whatever
  // case the writer felt like — `?mml=CDE` as readily as `?mml=cde`.
  const parts = expandRepeats(mml.toLowerCase()).split(",").map(readPart);

  // The pickup is a property of the song, not of a voice within it, so it is read once from the
  // first part; every part's bar lines are then checked against it, which catches a part that has
  // drifted out of step with the others.
  const pickup = leadIn(parts[0].barLines, beatsPerBar);

  for (const part of parts) {
    for (const at of part.barLines) {
      const beat = at + pickup;
      if (Math.abs(beat % beatsPerBar) > 1e-6) {
        throw new Error(
          `小節線が小節の頭から${
            (beat % beatsPerBar).toFixed(3)
          }拍ずれています。1小節は${beatsPerBar}拍です。`,
        );
      }
    }
    if (Math.abs(part.beats - parts[0].beats) > 1e-6) {
      throw new Error(
        `パートの長さが${
          parts.map((one) => one.beats).join("拍と")
        }拍でちがいます。パートは同時に鳴るので、どれも曲と同じ長さにしてください。`,
      );
    }
  }

  // Bar lines are an accounting, and one that does not balance is a mistake worth stopping for.
  // A melody that writes none is not accounting for anything — `?mml=cde` is three notes and a
  // wish — so its last bar is simply short, and the rest of it is silence.
  const total = parts[0].beats + pickup;
  const accounted = parts.some((part) => part.barLines.length > 0);
  if (accounted && Math.abs(total % beatsPerBar) > 1e-6) {
    throw new Error(
      `旋律が${total}拍で、${beatsPerBar}拍の小節に割り切れません。`,
    );
  }

  // In time order, and a chord's notes low to high: the game reads the last note of the list to
  // know when the song is over, and draws them in the order it is given.
  const notes = parts
    .flatMap((part) => part.notes)
    .map((note) => ({ ...note, beat: note.beat + pickup }))
    .sort((a, b) => a.beat - b.beat || a.midi - b.midi);

  return {
    notes,
    bars: Math.ceil(total / beatsPerBar - 1e-9),
    bpm: tempoOf(parts),
    pickup,
  };
}

/**
 * The one tempo the parts agree on.
 *
 * A part that says nothing about the tempo takes the song's; two that disagree are a mistake in the
 * writing, not something to resolve by picking one.
 */
function tempoOf(parts: readonly Read[]): number {
  const set = new Set(
    parts.map((part) => part.tempo).filter((tempo) => tempo !== null),
  );
  if (set.size > 1) {
    throw new Error(
      `パートによってテンポが${
        [...set].join("と")
      }でちがいます。曲のテンポはひとつです。`,
    );
  }
  return [...set][0] ?? DEFAULT_TEMPO;
}

/**
 * How far the melody has to move right for its bar lines to land on the grid.
 *
 * The first bar line says how long the first bar is. Anything shorter than a full bar is a pickup,
 * and the melody starts that far before the first downbeat.
 */
function leadIn(barLines: readonly number[], beatsPerBar: number): number {
  const first = barLines[0];
  if (first === undefined || first === 0) return 0;
  const short = ((beatsPerBar - first) % beatsPerBar + beatsPerBar) %
    beatsPerBar;
  return short;
}

interface Read {
  notes: Note[];
  /** Where each `|` fell, in beats from the start of what was written. */
  barLines: number[];
  beats: number;
  /** What this part's `t` said, or null when it did not say. */
  tempo: number | null;
}

/** Walks one part, left to right, carrying the state the commands change. */
function readPart(part: string): Read {
  const notes: Note[] = [];
  const barLines: number[] = [];
  let tempo: number | null = null;
  let length = DEFAULT_LENGTH;
  let octave = DEFAULT_OCTAVE;
  let beat = 0;
  let sounded = false;
  let tie = false;

  let at = 0;
  while (at < part.length) {
    const char = part[at];

    if (/\s/.test(char)) {
      at += 1;
      continue;
    }

    if (char === "|") {
      barLines.push(beat);
      at += 1;
      continue;
    }

    if (char === "&") {
      tie = true;
      at += 1;
      continue;
    }

    if (char === ">" || char === "<") {
      octave += char === ">" ? 1 : -1;
      at += 1;
      continue;
    }

    // A command whose argument is a number.
    if (/[tlovq@]/.test(char)) {
      const [value, next] = number(part, at + 1, char);
      at = next;
      if (char === "t") {
        if (sounded && tempo !== null && value !== tempo) {
          throw new Error(
            "テンポが途中で変わっています。曲のテンポはひとつです。",
          );
        }
        tempo = value;
      } else if (char === "l") {
        length = value;
      } else if (char === "o") {
        octave = value;
      }
      // `v`, `q` and `@` describe a synthesizer voice the game does not use.
      continue;
    }

    // A note, a rest, or a pitch by number.
    let midi: number | null = null;
    if (char === "n") {
      const [value, next] = number(part, at + 1, char);
      midi = value;
      at = next;
    } else if (char === "r") {
      at += 1;
    } else if (char in LETTER_SEMITONES) {
      let semitones = LETTER_SEMITONES[char];
      at += 1;
      while (at < part.length && "+#-".includes(part[at])) {
        semitones += part[at] === "-" ? -1 : 1;
        at += 1;
      }
      midi = (octave + 1) * 12 + semitones;
    } else {
      throw new Error(`「${char}」はこの書きかたにない文字です。`);
    }

    // The length, then any dots, then the beats they add up to.
    let value = length;
    if (/\d/.test(part[at] ?? "")) {
      const [read, next] = number(part, at, char);
      value = read;
      at = next;
    }
    let beats = 4 / value;
    let dot = beats;
    while (part[at] === ".") {
      dot /= 2;
      beats += dot;
      at += 1;
    }

    if (midi === null) {
      // A rest is silence that still takes its time.
      tie = false;
      beat += beats;
      continue;
    }

    const previous = notes[notes.length - 1];
    if (tie) {
      if (previous === undefined || previous.midi !== midi) {
        throw new Error("タイ（&）は同じ高さの音どうしをつなぎます。");
      }
      previous.beats += beats;
      noteShape(previous.beats);
      tie = false;
    } else {
      noteShape(beats);
      notes.push({ midi, beat, beats });
    }
    sounded = true;
    beat += beats;
  }

  if (tie) throw new Error("タイ（&）が旋律の終わりで宙に浮いています。");
  return { notes, barLines, beats: beat, tempo };
}

/** Reads the number a command or a note length is written with. */
function number(
  source: string,
  from: number,
  command: string,
): [value: number, next: number] {
  let at = from;
  while (at < source.length && /\d/.test(source[at])) at += 1;
  if (at === from) {
    throw new Error(`「${command}」のあとには数字が要ります。`);
  }
  return [Number(source.slice(from, at)), at];
}

/**
 * Writes `[ … ]n` out in full, innermost first.
 *
 * Repeating the text rather than the notes keeps everything after this point a straight left-to-
 * right read, and a repeat that carries an octave shift or a length change repeats that too — the
 * same thing a player does when their eye goes back to the bracket.
 */
function expandRepeats(mml: string): string {
  if (mml.length > MAX_LENGTH) throw new Error("楽譜が長すぎます。");
  let source = mml;
  for (let guard = 0; guard < 100; guard += 1) {
    const close = source.indexOf("]");
    if (close === -1) {
      if (source.includes("[")) {
        throw new Error("くり返しの [ が閉じていません。");
      }
      return source;
    }
    const open = source.lastIndexOf("[", close);
    if (open === -1) throw new Error("くり返しの ] に対する [ がありません。");

    let after = close + 1;
    while (after < source.length && /\d/.test(source[after])) after += 1;
    const times = after > close + 1
      ? Number(source.slice(close + 1, after))
      : 2;
    if (!(times >= 0)) {
      throw new Error("くり返しの回数にマイナスは書けません。");
    }

    const body = source.slice(open + 1, close);
    if ((body.length + 2) * times > MAX_LENGTH) {
      throw new Error("くり返しを書き出すと長くなりすぎます。");
    }
    source = source.slice(0, open) + ` ${body} `.repeat(times) +
      source.slice(after);
    if (source.length > MAX_LENGTH) {
      throw new Error("くり返しを書き出すと長くなりすぎます。");
    }
  }
  throw new Error("くり返しの入れ子が深すぎます。");
}
