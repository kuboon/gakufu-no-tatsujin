import { assertEquals, assertThrows } from "@std/assert";

import {
  BLANK,
  buildCustom,
  CUSTOM_ID,
  type CustomSpec,
  readSearch,
  searchFor,
} from "../islands/custom.ts";
import { readMml } from "../islands/mml.ts";
import { SONGS } from "../islands/songs.ts";

/** The song a spec builds, or a thrown error carrying why it did not. */
function built(over: Partial<CustomSpec>) {
  const result = buildCustom({ ...BLANK, ...over });
  if ("error" in result) throw new Error(result.error);
  return result.song;
}

/** The message a spec comes back with, for the specs that do not build. */
function refused(over: Partial<CustomSpec>): string {
  const result = buildCustom({ ...BLANK, ...over });
  if ("song" in result) throw new Error("this one built");
  return result.error;
}

Deno.test("no mml in the query string means no melody", () => {
  assertEquals(readSearch(""), null);
  assertEquals(readSearch("?title=hello"), null);
});

Deno.test("the shortest link is the notes and nothing else", () => {
  assertEquals(readSearch("?mml=CDE"), {
    mml: "CDE",
    title: "",
    beatsPerBar: 4,
    clef: "treble",
  });

  const song = built({ mml: "CDE" });
  assertEquals(song.notes.map((note) => note.midi), [60, 62, 64]);
  assertEquals(song.title, "じぶんの曲");
  assertEquals(song.custom, true);
  assertEquals(song.id, CUSTOM_ID);
});

Deno.test("a melody with no bar lines may stop in the middle of one", () => {
  const song = built({ mml: "CDE" });
  assertEquals(song.bars, 1);
  assertEquals(built({ mml: "o4 l4 c c c c c" }).bars, 2);
  // With bar lines the writer is accounting for bars, and it has to balance.
  assertEquals(built({ mml: "o4 l4 | c c c c" }).bars, 1);
});

Deno.test("case means nothing, in a link or anywhere else", () => {
  assertEquals(
    readMml("O4 L4 C D E F", 4).notes,
    readMml("o4 l4 c d e f", 4).notes,
  );
});

Deno.test("a link reads back as the same music, spacing aside", () => {
  const spec: CustomSpec = {
    mml: "t90 l4 o4 | c d | e f",
    title: "ためし",
    beatsPerBar: 2,
    clef: "bass",
  };
  const back = readSearch(searchFor(spec));
  if (back === null) throw new Error("the link carried no melody");
  assertEquals({ ...back, mml: spec.mml }, spec);
  assertEquals(
    readMml(back.mml, spec.beatsPerBar),
    readMml(spec.mml, spec.beatsPerBar),
  );
});

/**
 * Every melody on the song list, as it is written rather than as it was read.
 *
 * A {@link Song} keeps its notes, not the notation they came from, so this goes to the source —
 * which makes the list below the corpus this property is checked against, and a song added later
 * joins it without anyone remembering to.
 */
async function written(): Promise<string[]> {
  const source = await Deno.readTextFile(
    new URL("../islands/songs.ts", import.meta.url),
  );
  const found = [...source.matchAll(/mml: `([^`]*)`/g)].map((match) =>
    match[1]
  );
  // A change to how a song is written must not quietly stop this covering them.
  assertEquals(found.length, SONGS.length);
  return found;
}

Deno.test("taking the spacing out never changes the music", async () => {
  const melodies = await written();
  for (const [index, mml] of melodies.entries()) {
    const song = SONGS[index];
    assertEquals(
      readMml(mml.replace(/\s+/g, ""), song.beatsPerBar),
      readMml(mml, song.beatsPerBar),
      song.id,
    );
  }
});

Deno.test("closing a gap cannot run two numbers together", () => {
  // Nothing in the notation begins with a digit, so a number always ends where
  // the next thing begins — which is what makes the link safe to squeeze.
  for (
    const [spaced, bare] of [
      ["t120 l8 o4 c", "t120l8o4c"],
      ["c4 d4", "c4d4"],
      ["o4 c4. d8 e2", "o4c4.d8e2"],
      ["c4 & c4 d2", "c4&c4d2"],
      ["[ o4 c4 d4 ]3 e2", "[o4c4d4]3e2"],
      ["o4 c4 , o3 c4", "o4c4,o3c4"],
      ["o4 | c4 d4 e4 f4 | g1", "o4|c4d4e4f4|g1"],
      ["o4 n60 n62 c+4 d-4", "o4n60n62c+4d-4"],
    ]
  ) {
    assertEquals(readMml(bare, 4), readMml(spaced, 4), spaced);
  }
});

Deno.test("a link carries only what is not already the default", () => {
  const search = searchFor({ ...BLANK, mml: "c d e r" });
  assertEquals(search.includes("beats="), false);
  assertEquals(search.includes("clef="), false);
  assertEquals(search.includes("title="), false);
  // Whitespace is for writing, not for playing, so none of it reaches the link.
  assertEquals(searchFor({ ...BLANK, mml: " c\n  d\te " }), "?mml=cde");
  assertEquals(
    searchFor({ ...BLANK, mml: "t120 l4 o4 | c d e f" }),
    "?mml=t120l4o4%7Ccdef",
  );
});

Deno.test("the custom id belongs to no song on the list", () => {
  assertEquals(SONGS.some((song) => song.id === CUSTOM_ID), false);
});

Deno.test("a melody that will not play says why, rather than throwing", () => {
  assertEquals(refused({ mml: "" }), "楽譜がまだ空です。");
  assertEquals(refused({ mml: "   " }), "楽譜がまだ空です。");
  assertEquals(refused({ mml: "r r r r" }), "音符がひとつもありません。");
  // Bar lines that do not balance; without any, a short last bar is allowed.
  assertEquals(
    refused({ mml: "| c d e" }).includes("割り切れません"),
    true,
  );
  assertEquals(
    refused({ mml: "c z" }).includes("この書きかたにない文字"),
    true,
  );
  // Two octaves need fifteen white keys, and the keyboard shows nine.
  assertEquals(
    refused({ mml: "o4 l1 c , o6 l1 c" }).includes("白鍵が15要ります"),
    true,
  );
});

Deno.test("the bar length has to be a whole number of beats, and a small one", () => {
  const complaint = "1小節の拍数は1から16までの整数です。";
  assertEquals(refused({ mml: "c", beatsPerBar: 0 }), complaint);
  assertEquals(refused({ mml: "c", beatsPerBar: 1.5 }), complaint);
  assertEquals(refused({ mml: "c", beatsPerBar: 17 }), complaint);
  // `?beats=x` is what an unreadable one in a link comes through as.
  assertEquals(refused({ mml: "c", beatsPerBar: Number("x") }), complaint);
});

Deno.test("a repeat cannot be used to hand someone an enormous melody", () => {
  assertThrows(
    () => readMml("[ o4 c4 ]999999999", 4),
    Error,
    "長くなりすぎます",
  );
  assertEquals(
    refused({ mml: "[ o4 c4 c4 c4 c4 ]800" }).includes("音符が"),
    true,
  );
});

Deno.test("a link cannot hand the page a title too long to show", () => {
  const song = built({ mml: "c", title: "あ".repeat(200) });
  assertEquals(song.title, "あ".repeat(40));
});

Deno.test("notation too long to be a melody is refused before it is read", () => {
  assertThrows(() => readMml("c ".repeat(20_000), 4), Error, "長すぎます");
});
