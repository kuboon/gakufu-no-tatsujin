import { assertEquals, assertThrows } from "@std/assert";

import { readMml } from "../islands/mml.ts";
import { BOTH_SONGS, song, SONGS, type SongSpec } from "../islands/songs.ts";

/** A song with a left hand, so two-hand mode has something to read. */
function spec(over: Partial<SongSpec> = {}): SongSpec {
  return {
    id: "test",
    title: "テスト",
    credit: "",
    lead: "",
    difficulty: 1,
    beatsPerBar: 4,
    mml: "t100 l4 o4 | c d e f | g1",
    left: "l2 o3 | c g | c1",
    ...over,
  };
}

/** Pitches and start beats, the way they are played. */
function heard(notes: readonly { midi: number; beat: number }[]): string[] {
  return notes.map((note) => `${note.midi}@${note.beat}`);
}

Deno.test("readMml keeps each part's notes apart as well as merged", () => {
  const melody = readMml("l2 c d, l2 e f", 4);
  assertEquals(melody.voices.length, 2);
  assertEquals(heard(melody.voices[0]), ["60@0", "62@2"]);
  assertEquals(heard(melody.voices[1]), ["64@0", "65@2"]);
  assertEquals(heard(melody.notes), ["60@0", "64@0", "62@2", "65@2"]);
});

Deno.test("a song without a left hand has no two-hand version", () => {
  assertEquals(song(spec({ left: undefined })).both, undefined);
});

Deno.test("the melody alone is the right hand, as before", () => {
  const one = song(spec());
  assertEquals(heard(one.notes), ["60@0", "62@1", "64@2", "65@3", "67@4"]);
  assertEquals(one.staves, undefined);
});

Deno.test("the two-hand version puts each hand on its own staff", () => {
  const both = song(spec()).both!;
  assertEquals(both.id, "test:both");
  assertEquals(both.bars, 2);
  assertEquals(both.bpm, 100);

  const [right, left] = both.staves!;
  assertEquals(right.clef, "treble");
  assertEquals(left.clef, "bass");
  assertEquals(heard(right.notes), [
    "60@0",
    "62@1",
    "64@2",
    "65@3",
    "67@4",
  ]);
  assertEquals(heard(left.notes), ["48@0", "55@2", "48@4"]);
  assertEquals([left.lowest, left.highest], [48, 55]);

  // Judged together, so the song's notes are both hands in time order.
  assertEquals(both.notes.length, 8);
  assertEquals(heard(both.notes).slice(0, 3), ["48@0", "60@0", "62@1"]);
  assertEquals([both.lowest, both.highest], [48, 67]);
});

Deno.test("a left hand may be a chord, written as parts of its own", () => {
  const both = song(spec({ left: "l1 o3 | c | c, l1 o3 | g | g" })).both!;
  assertEquals(heard(both.staves![1].notes), [
    "48@0",
    "55@0",
    "48@4",
    "55@4",
  ]);
});

Deno.test("a left hand under a pickup starts where the melody does", () => {
  const both = song(spec({
    mml: "l4 o4 g | c2. | c2.",
    left: "l4 o3 r | c2. | c2.",
    beatsPerBar: 3,
  })).both!;
  // The melody's one-beat pickup moves everything two beats along.
  assertEquals(heard(both.staves![0].notes)[0], "67@2");
  assertEquals(heard(both.staves![1].notes), ["48@3", "48@6"]);
});

Deno.test("the left hand has to fit the melody's bars", () => {
  assertThrows(
    () => song(spec({ left: "l2 o3 | c g | c1 | c1" })),
    Error,
    "長さ",
  );
  assertThrows(
    () => song(spec({ left: "l4 o3 | c c c | c c c c c" })),
    Error,
    "小節線",
  );
});

Deno.test("the left hand has no keyboard to fit", () => {
  // Three octaves below the melody: far more keys than the screen has, and fine, because two
  // hands are played on a MIDI keyboard.
  const both = song(spec({ left: "l2 o1 | c g | c1" })).both!;
  assertEquals(both.staves![1].lowest, 24);
});

Deno.test("the two-hand list is every song that has a left hand", () => {
  assertEquals(
    BOTH_SONGS.map((one) => one.id),
    SONGS.flatMap((one) => one.both === undefined ? [] : [`${one.id}:both`]),
  );
});
