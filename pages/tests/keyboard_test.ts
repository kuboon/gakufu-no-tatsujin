import { assertAlmostEquals, assertEquals, assertThrows } from "@std/assert";

import {
  keyboardLayout,
  keyRange,
  typingMap,
  WHITE_KEYS,
} from "../islands/keyboard.ts";
import { isBlackKey, midiFromName } from "../islands/music.ts";
import { SONGS } from "../islands/songs.ts";

Deno.test("a range becomes the keyboard's fixed span, anchored at its bottom", () => {
  // C4 up to A4 needs six white keys and gets nine, the spare three above it.
  assertEquals(keyRange(midiFromName("C4"), midiFromName("A4")), {
    from: midiFromName("C4"),
    to: midiFromName("D5"),
  });
  // A black note at either end still starts the keyboard on a whole white key.
  assertEquals(keyRange(61, 70), {
    from: midiFromName("C4"),
    to: midiFromName("D5"),
  });
  // Shifted up an octave: the same nine keys, a different set of pitches.
  assertEquals(keyRange(midiFromName("C5"), midiFromName("A5")), {
    from: midiFromName("C5"),
    to: midiFromName("D6"),
  });
});

Deno.test("every song is played on the same number of keys", () => {
  for (const song of SONGS) {
    const { from, to } = keyRange(song.lowest, song.highest);
    const keys = keyboardLayout(from, to);
    assertEquals(
      keys.filter((key) => !key.black).length,
      WHITE_KEYS,
      song.title,
    );
    // Anchored at the bottom, and wide enough for the whole melody.
    assertEquals(from, song.lowest - (isBlackKey(song.lowest) ? 1 : 0));
    assertEquals(to >= song.highest, true, song.title);
  }
});

Deno.test("a song wider than the keyboard fails the build", () => {
  // Two octaves is fifteen white keys, and the keyboard shows nine.
  assertThrows(
    () => keyRange(midiFromName("C4"), midiFromName("C6")),
    Error,
    `the keyboard shows ${WHITE_KEYS}`,
  );
  // One white key too many is refused just the same.
  const tenth = keyRange(60, 60).to + 2;
  assertThrows(() => keyRange(60, tenth), Error, "white keys");
});

Deno.test("white keys tile the width and black keys straddle the seams", () => {
  const keys = keyboardLayout(60, 72);
  const whites = keys.filter((key) => !key.black);
  const blacks = keys.filter((key) => key.black);

  assertEquals(whites.length, 8);
  assertEquals(blacks.length, 5);
  assertAlmostEquals(whites[0].left, 0);
  assertAlmostEquals(
    whites[whites.length - 1].left + whites[whites.length - 1].width,
    1,
  );

  for (let i = 1; i < whites.length; i++) {
    assertAlmostEquals(
      whites[i].left,
      whites[i - 1].left + whites[i - 1].width,
    );
  }

  // C#4 sits centred on the seam between C4 and D4.
  const seam = whites[1].left;
  assertAlmostEquals(blacks[0].left + blacks[0].width / 2, seam);
});

Deno.test("the computer keyboard lands where a piano would", () => {
  const typed = typingMap(keyboardLayout(60, 72));
  assertEquals(typed.get("a"), 60);
  assertEquals(typed.get("w"), 61);
  assertEquals(typed.get("s"), 62);
  assertEquals(typed.get("k"), 72);
  assertEquals(typed.get("z"), undefined);
});
