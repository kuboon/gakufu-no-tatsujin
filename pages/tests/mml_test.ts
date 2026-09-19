import { assertEquals, assertThrows } from "@std/assert";

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
  assertThrows(() => played("o4 l4 c&d c2"), Error, "同じ高さの音どうし");
});

Deno.test("the tempo comes from t, and cannot change part-way", () => {
  assertEquals(readMml("t144 o4 l1 c", 4).bpm, 144);
  // No `t` at all is the dialect's default.
  assertEquals(readMml("o4 l1 c", 4).bpm, 120);
  assertThrows(
    () => readMml("t100 o4 l1 c t120 c", 8),
    Error,
    "テンポが途中で変わっています",
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
    "小節線が小節の頭から",
  );
  assertThrows(
    () => readMml("o4 l4 | c c c", 4),
    Error,
    "割り切れません",
  );
});

Deno.test("a length no note head can write is refused", () => {
  assertThrows(() => readMml("o4 l3 c", 4), Error, "音符で書けない長さ");
});

Deno.test("notation the reader does not know is refused", () => {
  assertThrows(() => readMml("o4 l4 z", 4), Error, "この書きかたにない文字");
  assertThrows(() => readMml("o4 l4 [ c", 4), Error, "[ が閉じていません");
  assertThrows(
    () => readMml("o4 l4 c ]", 4),
    Error,
    "] に対する [ がありません",
  );
});

Deno.test("parts separated by a comma play at once", () => {
  // A chord: two parts, both a bar long, merged into one list in time order.
  assertEquals(played("o4 l4 c e g r , o3 l4 c r r r", 4), [
    "48@0+1",
    "60@0+1",
    "64@1+1",
    "67@2+1",
  ]);
});

Deno.test("either part may set the tempo, and they have to agree", () => {
  assertEquals(readMml("t90 l4 o4 c , l4 o3 c", 1).bpm, 90);
  assertEquals(readMml("l4 o4 c , t90 l4 o3 c", 1).bpm, 90);
  assertEquals(readMml("t90 l4 o4 c , t90 l4 o3 c", 1).bpm, 90);
  assertThrows(
    () => readMml("t90 l4 o4 c , t120 l4 o3 c", 1),
    Error,
    "曲のテンポはひとつ",
  );
});

Deno.test("parts have to be the same length, and share the bar lines", () => {
  assertThrows(
    () => readMml("l4 o4 | c c | c c , l4 o3 | c c | c", 2),
    Error,
    "どれも曲と同じ長さ",
  );
  assertThrows(
    () => readMml("l4 o4 | c c | c c , l4 o3 | c | c c c", 2),
    Error,
    "小節線が小節の頭から",
  );
});

Deno.test("every song fills whole bars and lands on its bar lines", () => {
  for (const song of SONGS) {
    // The song may end on a rest, so the last note only has to fall in the last bar.
    const end = Math.max(
      ...song.notes.map((note) => note.beat + note.beats),
    );
    const finish = song.bars * song.beatsPerBar;
    assertEquals(end <= finish + 1e-9, true, song.id);
    assertEquals(end > finish - song.beatsPerBar, true, song.id);
    assertEquals(song.bpm > 0, true, song.id);
  }
});
