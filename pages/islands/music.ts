/**
 * The music model, shared by the staff, the keyboard and the play engine.
 *
 * Two ideas live here. A pitch has a *colour*: the twelve semitones are the twelve hues of the
 * colour wheel, so a note is the same colour on the staff as the key that plays it. And a duration
 * has a *shape*: the head, stem and flags that say how long a note lasts, which is the half of the
 * rhythm that scroll timing cannot show on its own.
 */

import type { RestName } from "./rests.ts";

/** Letter (0 = C … 6 = B) and accidental (0 or 1 semitone) for each pitch class. */
const SPELLING: readonly (readonly [letter: number, sharp: number])[] = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
  [2, 0],
  [3, 0],
  [3, 1],
  [4, 0],
  [4, 1],
  [5, 0],
  [5, 1],
  [6, 0],
];

const LETTERS = "CDEFGAB";
const LETTER_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const SOLFA = [
  "ド",
  "ド♯",
  "レ",
  "レ♯",
  "ミ",
  "ファ",
  "ファ♯",
  "ソ",
  "ソ♯",
  "ラ",
  "ラ♯",
  "シ",
];

/** Pitch class of a MIDI note, 0 = C. */
export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

/** Whether the key that plays this note is a black one. */
export function isBlackKey(midi: number): boolean {
  return SPELLING[pitchClass(midi)][1] === 1;
}

/** The note's name in Japanese solfège — what the key and the note head are labelled with. */
export function solfa(midi: number): string {
  return SOLFA[pitchClass(midi)];
}

/** The note as a person says it, octave and all: `ラ♯3`. What a message about a pitch names. */
export function pitchLabel(midi: number): string {
  return `${solfa(midi)}${Math.floor(midi / 12) - 1}`;
}

/** Hue in degrees: the twelve semitones split the colour wheel evenly, C at 0°. */
export function hue(midi: number): number {
  return pitchClass(midi) * 30;
}

/** The note's colour on the staff. */
export function noteColor(midi: number, lightness = 58): string {
  return `hsl(${hue(midi)} 90% ${lightness}%)`;
}

/** The same colour, translucent — the halo a cued key casts onto the bed. */
export function glowColor(midi: number, alpha = 0.5): string {
  return `hsl(${hue(midi)} 90% 58% / ${alpha})`;
}

/**
 * The face colour of the key that plays it: tinted ivory for a white key, deep for a black one.
 *
 * Held below the note colour's saturation on purpose. The keys are half the screen, so a full-
 * strength pastel row glares against the warm ground; the hue is what carries the pitch, and it
 * survives the drop.
 */
export function keyColor(midi: number): string {
  return isBlackKey(midi)
    ? `hsl(${hue(midi)} 55% 24%)`
    : `hsl(${hue(midi)} 78% 80%)`;
}

/**
 * Vertical position on the staff, in diatonic steps above C0 — one step is half a staff space, so
 * consecutive steps alternate line, space, line.
 */
export function staffStep(midi: number): number {
  const octave = Math.floor(midi / 12) - 1;
  return octave * 7 + SPELLING[pitchClass(midi)][0];
}

/** 1 when the note is written with a sharp in front of it, 0 otherwise. */
export function isSharpened(midi: number): boolean {
  return SPELLING[pitchClass(midi)][1] === 1;
}

/** Parses a note name like `C4`, `F#4` or `A3` into a MIDI number (C4 = 60). */
export function midiFromName(name: string): number {
  const match = /^([A-G])(#?)(-?\d)$/.exec(name);
  if (match === null) {
    throw new Error(`「${name}」は "C4" や "F#4" のような音名ではありません。`);
  }
  const letter = LETTERS.indexOf(match[1]);
  const octave = Number(match[3]);
  return (octave + 1) * 12 + LETTER_SEMITONES[letter] +
    (match[2] === "#" ? 1 : 0);
}

/** How a duration is written: an open or filled head, a stem, flags, and any dots. */
export interface NoteShape {
  filled: boolean;
  stem: boolean;
  flags: number;
  /** 0, 1 or 2. Each dot adds half of what the one before it added. */
  dots: number;
}

/** What a dot, and then a second one, multiply a value by. */
const DOTS = [1, 1.5, 1.75];

/** Undotted note values, in beats (a beat is a quarter note). */
const VALUES: readonly (readonly [
  beats: number,
  filled: boolean,
  stem: boolean,
  flags: number,
])[] = [
  [4, false, false, 0],
  [2, false, true, 0],
  [1, true, true, 0],
  [0.5, true, true, 1],
  [0.25, true, true, 2],
];

/**
 * The shape that writes a duration.
 *
 * A dot adds half of the value again, and a second dot half of what the first added — so the
 * multipliers to try are 1, 1.5 and 1.75. Beyond two dots is not notation anyone reads at speed.
 */
export function noteShape(beats: number): NoteShape {
  for (const [value, filled, stem, flags] of VALUES) {
    for (const [dots, multiplier] of DOTS.entries()) {
      if (Math.abs(beats - value * multiplier) < 1e-6) {
        return { filled, stem, flags, dots };
      }
    }
  }
  throw new Error(`${beats}拍は音符で書けない長さです。`);
}

/** One note of a melody. */
export interface Note {
  midi: number;
  /** Start, in beats from the top of the song. */
  beat: number;
  /** Length, in beats. */
  beats: number;
}

/** A stretch of a melody where nothing sounds, written as one rest. */
export interface Rest {
  beat: number;
  beats: number;
  value: RestName;
  /** 0, 1 or 2, as on a note. */
  dots: number;
}

/**
 * How a length of silence is written.
 *
 * The same table the note heads use, because a rest is the same durations with a different mark.
 *
 * @throws When no rest of that length can be written
 */
export function restShape(beats: number): { value: RestName; dots: number } {
  for (const [index, [value]] of VALUES.entries()) {
    for (const [dots, multiplier] of DOTS.entries()) {
      if (Math.abs(beats - value * multiplier) < 1e-6) {
        return { value: REST_NAMES[index], dots };
      }
    }
  }
  throw new Error(`${beats}拍は休符で書けない長さです。`);
}

/** The rest each row of {@link VALUES} is written with, in the same order. */
const REST_NAMES: readonly RestName[] = [
  "whole",
  "half",
  "quarter",
  "eighth",
  "sixteenth",
];

/**
 * Where a melody falls silent, and how each silence is written.
 *
 * Derived from the notes rather than read out of the notation, which is what makes it right for a
 * melody written in several parts: what the player sees as "nothing to play" is the stretch where
 * *no* part is sounding, and a rest written into one voice while another holds a note is not that.
 *
 * Each silence is then cut at the bar lines and spelled out, because a rest belongs to one bar and
 * a reader takes its length from where it sits. A bar with nothing in it at all is one whole rest,
 * whatever the time signature — that is the convention, and it is what the printed scores this
 * game is transcribed from do.
 *
 * @param notes The melody, in any order
 * @param beatsPerBar The time signature's beats
 * @param bars How many bars the melody covers
 */
export function silences(
  notes: readonly Note[],
  beatsPerBar: number,
  bars: number,
): Rest[] {
  const sounding = merged(notes);
  const rests: Rest[] = [];

  for (let bar = 0; bar < bars; bar += 1) {
    const start = bar * beatsPerBar;
    for (const [from, to] of gaps(sounding, start, start + beatsPerBar)) {
      if (from === start && Math.abs(to - start - beatsPerBar) < 1e-6) {
        rests.push({
          beat: start,
          beats: beatsPerBar,
          value: "whole",
          dots: 0,
        });
        continue;
      }
      spell(from - start, to - start, rests, start);
    }
  }

  return rests;
}

/** The stretches where at least one note is sounding, in order and without overlaps. */
function merged(notes: readonly Note[]): [from: number, to: number][] {
  const spans = notes
    .map((note): [number, number] => [note.beat, note.beat + note.beats])
    .sort((a, b) => a[0] - b[0]);

  const out: [number, number][] = [];
  for (const span of spans) {
    const last = out[out.length - 1];
    if (last !== undefined && span[0] <= last[1] + 1e-9) {
      last[1] = Math.max(last[1], span[1]);
    } else {
      out.push([...span]);
    }
  }
  return out;
}

/** What is left of `from`–`to` once the sounding stretches are taken out of it. */
function gaps(
  sounding: readonly (readonly [number, number])[],
  from: number,
  to: number,
): [number, number][] {
  const out: [number, number][] = [];
  let at = from;
  for (const [start, end] of sounding) {
    if (end <= at + 1e-9) continue;
    if (start >= to - 1e-9) break;
    if (start > at + 1e-9) out.push([at, Math.min(start, to)]);
    at = Math.max(at, end);
    if (at >= to - 1e-9) break;
  }
  if (at < to - 1e-9) out.push([at, to]);
  return out;
}

/**
 * Writes one stretch of silence inside a bar as rests, longest first.
 *
 * A rest may only start where its own length divides the bar — a half rest on the second beat of
 * four reads as spanning the bar's middle, which is exactly what notation avoids. Taking the
 * longest value that both fits and lands on its own multiple is the whole rule, and it is why a
 * bar that rests for three beats after one note comes out as a quarter and then a half.
 *
 * @param from Beats from the start of the bar
 * @param to Beats from the start of the bar
 * @param into The list to append to
 * @param bar The bar's own start, in beats from the top of the song
 */
function spell(
  from: number,
  to: number,
  into: Rest[],
  bar: number,
): void {
  const WRITABLE = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.375, 0.25];
  let at = from;

  // Bounded rather than `while`: a length the table cannot reach must end the loop rather than
  // spin on it, and the leftover is too short to see.
  for (let guard = 0; guard < 64 && to - at > 1e-6; guard += 1) {
    const left = to - at;
    const value = WRITABLE.find((one) =>
      one <= left + 1e-9 && Math.abs(at % one) < 1e-9
    ) ?? WRITABLE.find((one) => one <= left + 1e-9);
    if (value === undefined) return;

    into.push({ beat: bar + at, beats: value, ...restShape(value) });
    at += value;
  }
}
