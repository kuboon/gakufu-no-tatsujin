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

/** Widens a pitch range to the white keys that enclose it, so the keyboard starts and ends whole. */
export function keyRange(
  lowest: number,
  highest: number,
): { from: number; to: number } {
  let from = lowest;
  let to = highest;
  while (isBlackKey(from)) from--;
  while (isBlackKey(to)) to++;
  return { from, to };
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
