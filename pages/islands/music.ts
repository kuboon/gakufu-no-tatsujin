/**
 * The music model, shared by the staff, the keyboard and the play engine.
 *
 * Two ideas live here. A pitch has a *colour*: the twelve semitones are the twelve hues of the
 * colour wheel, so a note is the same colour on the staff as the key that plays it. And a duration
 * has a *shape*: the head, stem and flags that say how long a note lasts, which is the half of the
 * rhythm that scroll timing cannot show on its own.
 */

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
    throw new Error(`"${name}" is not a note name like "C4" or "F#4".`);
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
  const DOTS = [1, 1.5, 1.75];
  for (const [value, filled, stem, flags] of VALUES) {
    for (const [dots, multiplier] of DOTS.entries()) {
      if (Math.abs(beats - value * multiplier) < 1e-6) {
        return { filled, stem, flags, dots };
      }
    }
  }
  throw new Error(`${beats} beats is not a note value this staff can write.`);
}

/** One note of a melody. */
export interface Note {
  midi: number;
  /** Start, in beats from the top of the song. */
  beat: number;
  /** Length, in beats. */
  beats: number;
}
