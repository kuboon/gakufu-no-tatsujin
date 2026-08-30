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

/** The face colour of the key that plays it: pale for a white key, deep for a black one. */
export function keyColor(midi: number): string {
  return isBlackKey(midi)
    ? `hsl(${hue(midi)} 65% 26%)`
    : `hsl(${hue(midi)} 92% 84%)`;
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

/** How a duration is written: an open or filled head, a stem, flags, and maybe a dot. */
export interface NoteShape {
  filled: boolean;
  stem: boolean;
  flags: number;
  dotted: boolean;
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

/** The shape that writes a duration. Dotted values are half again as long. */
export function noteShape(beats: number): NoteShape {
  for (const [value, filled, stem, flags] of VALUES) {
    if (Math.abs(beats - value) < 1e-6) {
      return { filled, stem, flags, dotted: false };
    }
    if (Math.abs(beats - value * 1.5) < 1e-6) {
      return { filled, stem, flags, dotted: true };
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

/**
 * Reads a melody written as bars of note names, e.g. `"C4 D4 E4:2 | G4 E4 D4 C4"`.
 *
 * A token is a note name with an optional `:beats` (one beat — a quarter note — by default), and
 * `|` separates bars. Every bar has to add up to the time signature, which is what turns a typo
 * into a build error rather than a melody that quietly drifts out of its bar lines.
 */
export function readScore(
  score: string,
  beatsPerBar: number,
): { notes: Note[]; bars: number } {
  const notes: Note[] = [];
  const bars = score.split("|").map((bar) => bar.trim()).filter((bar) =>
    bar.length > 0
  );

  bars.forEach((bar, index) => {
    let filled = 0;
    for (const token of bar.split(/\s+/)) {
      const [name, value] = token.split(":");
      const beats = value === undefined ? 1 : Number(value);
      if (!(beats > 0)) {
        throw new Error(`"${token}" does not name a length in beats.`);
      }
      noteShape(beats);
      notes.push({
        midi: midiFromName(name),
        beat: index * beatsPerBar + filled,
        beats,
      });
      filled += beats;
    }
    if (Math.abs(filled - beatsPerBar) > 1e-6) {
      throw new Error(
        `Bar ${index + 1} holds ${filled} beats, not ${beatsPerBar}.`,
      );
    }
  });

  return { notes, bars: bars.length };
}
