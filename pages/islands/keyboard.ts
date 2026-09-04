/**
 * The keyboard's geometry: which keys a song needs, and where each one sits.
 *
 * Positions come out as fractions of the keyboard's width so the layout is resolution independent
 * — the same numbers place the keys in CSS and read back the same in any orientation.
 */

import { isBlackKey } from "./music.ts";

/** One key of the keyboard. */
export interface KeyCap {
  midi: number;
  black: boolean;
  /** Left edge, as a fraction of the keyboard's width. */
  left: number;
  /** Width, as a fraction of the keyboard's width. */
  width: number;
}

/** How wide a black key is, relative to a white one. */
const BLACK_WIDTH = 0.62;

/**
 * How many white keys the keyboard shows — the same number for every song.
 *
 * Fixed on purpose. A keyboard sized to each song's range changed width from song to song, so a
 * finger that had learned where ミ sits had to find it again on the next song. Holding the count
 * still keeps the keys the same size and the same distance apart; all that moves between songs is
 * which pitches they carry.
 *
 * The number is the widest song on the list today — さくら さくら, シ3 から ド5 で9白鍵. Raising it
 * is a deliberate edit: a song that needs more keys fails the build rather than quietly shrinking
 * the keys for every other song.
 */
export const WHITE_KEYS = 9;

/**
 * The stretch of keyboard a song is played on: {@link WHITE_KEYS} white keys from the white key at
 * or below its lowest note.
 *
 * Anchored at the bottom rather than centred, so the low end of a melody starts at the left edge
 * the way it would on a piano, and the spare keys sit above it.
 *
 * @throws When the range needs more white keys than the keyboard shows
 */
export function keyRange(
  lowest: number,
  highest: number,
): { from: number; to: number } {
  const from = whiteAtOrBelow(lowest);
  const needed = whiteKeys(from, whiteAtOrAbove(highest));
  if (needed > WHITE_KEYS) {
    throw new Error(
      `A song from ${lowest} to ${highest} needs ${needed} white keys; the keyboard shows ${WHITE_KEYS}.`,
    );
  }

  // The WHITE_KEYS-th white key at or above `from`.
  let to = from;
  for (let counted = 1; counted < WHITE_KEYS; to++) {
    if (!isBlackKey(to + 1)) counted++;
  }
  return { from, to };
}

function whiteAtOrBelow(midi: number): number {
  let at = midi;
  while (isBlackKey(at)) at--;
  return at;
}

function whiteAtOrAbove(midi: number): number {
  let at = midi;
  while (isBlackKey(at)) at++;
  return at;
}

/** How many white keys there are from `from` to `to` inclusive. */
function whiteKeys(from: number, to: number): number {
  let count = 0;
  for (let midi = from; midi <= to; midi++) {
    if (!isBlackKey(midi)) count++;
  }
  return count;
}

/**
 * Lays out every key from `from` to `to` inclusive.
 *
 * White keys divide the width evenly; a black key straddles the seam between the two white keys it
 * sits between, which is what makes the result read as a piano rather than a row of buttons.
 */
export function keyboardLayout(from: number, to: number): KeyCap[] {
  const whites: number[] = [];
  for (let midi = from; midi <= to; midi++) {
    if (!isBlackKey(midi)) whites.push(midi);
  }

  const unit = 1 / whites.length;
  const keys: KeyCap[] = [];

  for (let midi = from; midi <= to; midi++) {
    if (isBlackKey(midi)) {
      // Seam between the white key below and the one above.
      const seam = (whites.filter((white) => white < midi).length) * unit;
      keys.push({
        midi,
        black: true,
        left: seam - unit * BLACK_WIDTH / 2,
        width: unit * BLACK_WIDTH,
      });
    } else {
      keys.push({
        midi,
        black: false,
        left: whites.indexOf(midi) * unit,
        width: unit,
      });
    }
  }

  return keys;
}

/** Home row for the white keys, and the row above it for the black keys between them. */
const WHITE_ROW = "asdfghjkl;";
const BLACK_ROW = "qwertyuiop";

/**
 * Maps computer keys onto the keyboard, so the game is playable on a laptop too.
 *
 * White keys take the home row in order and each black key takes the character above the seam it
 * straddles — the same relationship the two rows already have on a QWERTY keyboard.
 */
export function typingMap(keys: readonly KeyCap[]): Map<string, number> {
  const map = new Map<string, number>();
  let whites = 0;

  for (const key of keys) {
    if (key.black) {
      const character = BLACK_ROW[whites];
      if (character !== undefined) map.set(character, key.midi);
    } else {
      const character = WHITE_ROW[whites];
      if (character !== undefined) map.set(character, key.midi);
      whites++;
    }
  }

  return map;
}
