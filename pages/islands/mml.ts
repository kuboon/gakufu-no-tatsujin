/**
 * The MML reader.
 *
 * Songs arrive written in a small MML dialect — note letters, lengths, octave shifts, repeats —
 * which is how the melodies are authored and verified before they reach the game. This module is
 * the only place that knows that notation; everything downstream sees the same {@link Note} list
 * the rest of the game already speaks.
 *
 * What the dialect carries and the game cannot use is dropped on purpose. Volume, gate time and
 * waveform describe a synthesizer voice, and the game brings its own; a bar line is a reading aid
 * that playback ignores. The reader still parses all of it, so a song can be pasted in unchanged.
 */

import { type Note, noteShape } from "./music.ts";

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
 * @param mml The song, e.g. `"t120 l4 o4 | c d e f | e d c2"`
 * @param beatsPerBar The time signature's beats — MML carries no time signature
 * @returns The notes, in beats from the first downbeat of bar 1
 */
export function readMml(mml: string, beatsPerBar: number): Melody {
  const parts = expandRepeats(mml).split(",");
  if (parts.length > 1) {
    throw new Error(
      `This melody has ${parts.length} parts; the game plays one.`,
    );
  }

  const read = readPart(parts[0]);
  const pickup = leadIn(read.barLines, beatsPerBar);
  const notes = read.notes.map((note) => ({
    ...note,
    beat: note.beat + pickup,
  }));

  for (const at of read.barLines) {
    const beat = at + pickup;
    if (Math.abs(beat % beatsPerBar) > 1e-6) {
      throw new Error(
        `A bar line falls ${
          (beat % beatsPerBar).toFixed(3)
        } beats into a bar of ${beatsPerBar}.`,
      );
    }
  }

  const total = read.beats + pickup;
  if (Math.abs(total % beatsPerBar) > 1e-6) {
    throw new Error(
      `The melody is ${total} beats, which is not a whole number of ${beatsPerBar}-beat bars.`,
    );
  }

  return { notes, bars: total / beatsPerBar, bpm: read.tempo, pickup };
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
  tempo: number;
}

/** Walks one part, left to right, carrying the state the commands change. */
function readPart(part: string): Read {
  const notes: Note[] = [];
  const barLines: number[] = [];
  let tempo = DEFAULT_TEMPO;
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
        if (sounded && value !== tempo) {
          throw new Error(
            "The tempo changes part-way through; the game holds one tempo per song.",
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
      throw new Error(`"${char}" is not part of this notation.`);
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
        throw new Error("A tie has to join two notes of the same pitch.");
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

  if (tie) throw new Error("A tie is left hanging at the end of the melody.");
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
    throw new Error(`"${command}" needs a number after it.`);
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
  let source = mml;
  for (let guard = 0; guard < 100; guard += 1) {
    const close = source.indexOf("]");
    if (close === -1) {
      if (source.includes("[")) throw new Error("A repeat is never closed.");
      return source;
    }
    const open = source.lastIndexOf("[", close);
    if (open === -1) throw new Error("A repeat is closed but never opened.");

    let after = close + 1;
    while (after < source.length && /\d/.test(source[after])) after += 1;
    const times = after > close + 1
      ? Number(source.slice(close + 1, after))
      : 2;
    if (!(times >= 0)) throw new Error("A repeat count cannot be negative.");

    const body = source.slice(open + 1, close);
    source = source.slice(0, open) + ` ${body} `.repeat(times) +
      source.slice(after);
  }
  throw new Error("This melody nests repeats deeper than the reader follows.");
}
