import { assertAlmostEquals, assertEquals, assertThrows } from "@std/assert";

import { readMml } from "../islands/mml.ts";
import { SONGS } from "../islands/songs.ts";

/** The pitches and lengths of a melody, in the order they are played. */
function played(mml: string, beatsPerBar = 4) {
  return readMml(mml, beatsPerBar).notes.map((note) =>
    `${note.midi}@${note.beat}+${note.beats}`
  );
}

Deno.test("o4c is middle C, and a length is one over the number", () => {
  assertEquals(played("o4 c1"), ["60@0+4"]);
  assertEquals(played("o4 l4 c c2 c8 c16", 1 + 2 + 0.5 + 0.25), [
    "60@0+1",
    "60@1+2",
    "60@3+0.5",
    "60@3.5+0.25",
  ]);
});

Deno.test("accidentals move the letter, in either spelling", () => {
  assertEquals(played("o4 l1 c+", 4), ["61@0+4"]);
  assertEquals(played("o4 l1 c#", 4), ["61@0+4"]);
  assertEquals(played("o4 l1 d-", 4), ["61@0+4"]);
  assertEquals(played("o4 l1 n61", 4), ["61@0+4"]);
});

Deno.test("the octave is state: a shift holds until the next one", () => {
  // c4 b3 c4 — `<` and `>` move the whole octave, not one note.
  assertEquals(played("o4 l4 c <b >c c"), [
    "60@0+1",
    "59@1+1",
    "60@2+1",
    "60@3+1",
  ]);
});

Deno.test("dots add half again, and stack", () => {
  assertEquals(played("o4 l4 c.", 1.5), ["60@0+1.5"]);
  assertEquals(played("o4 l4 c..", 1.75), ["60@0+1.75"]);
});

Deno.test("a rest takes its time without sounding", () => {
  assertEquals(played("o4 l4 c r c r"), ["60@0+1", "60@2+1"]);
});

Deno.test("a repeat writes its body out, default twice", () => {
  assertEquals(played("o4 l4 [ c d ] [ e ]1 f", 6), [
    "60@0+1",
    "62@1+1",
    "60@2+1",
    "62@3+1",
    "64@4+1",
    "65@5+1",
  ]);
  // A shift inside a repeat repeats with it.
  assertEquals(played("o4 l1 [ c > ]2", 8), ["60@0+4", "72@4+4"]);
});

Deno.test("a tie joins two notes of the same pitch into one", () => {
  assertEquals(played("o4 l4 c&c c2"), ["60@0+2", "60@2+2"]);
  assertThrows(() => played("o4 l4 c&d c2"), Error, "same pitch");
});

Deno.test("the tempo comes from t, and cannot change part-way", () => {
  assertEquals(readMml("t144 o4 l1 c", 4).bpm, 144);
  // No `t` at all is the dialect's default.
  assertEquals(readMml("o4 l1 c", 4).bpm, 120);
  assertThrows(
    () => readMml("t100 o4 l1 c t120 c", 8),
    Error,
    "one tempo per song",
  );
});

Deno.test("a short first bar is a pickup, and moves the melody right", () => {
  // One beat before the first downbeat of a bar of three.
  const melody = readMml("o4 l4 g | c c c", 3);
  assertEquals(melody.pickup, 2);
  assertEquals(melody.bars, 2);
  assertEquals(melody.notes[0].beat, 2);
});

Deno.test("a bar line off the grid is a build error, not a drifting melody", () => {
  assertThrows(
    () => readMml("o4 l4 c c c c | c c c | c", 4),
    Error,
    "bar line falls",
  );
  assertThrows(
    () => readMml("o4 l4 c c c", 4),
    Error,
    "not a whole number",
  );
});

Deno.test("a length no note head can write is refused", () => {
  assertThrows(() => readMml("o4 l3 c", 4), Error, "note value");
});

Deno.test("notation the reader does not know is refused", () => {
  assertThrows(() => readMml("o4 l4 z", 4), Error, "not part of this notation");
  assertThrows(() => readMml("o4 l4 [ c", 4), Error, "never closed");
  assertThrows(() => readMml("o4 l4 c ]", 4), Error, "never opened");
  assertThrows(() => readMml("o4 l4 c , o4 l4 e", 4), Error, "parts");
});

Deno.test("every song fills whole bars and lands on its bar lines", () => {
  for (const song of SONGS) {
    const last = song.notes[song.notes.length - 1];
    assertAlmostEquals(
      last.beat + last.beats,
      song.bars * song.beatsPerBar,
      1e-9,
      song.id,
    );
    assertEquals(song.bpm > 0, true, song.id);
  }
});
