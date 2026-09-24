import { assertEquals, assertThrows } from "@std/assert";

import {
  hue,
  isBlackKey,
  midiFromName,
  type Note,
  noteShape,
  restShape,
  silences,
  solfa,
  staffStep,
} from "../islands/music.ts";
import { REST_GLYPHS } from "../islands/rests.ts";
import { readMml } from "../islands/mml.ts";
import { SONGS } from "../islands/songs.ts";
import { keyboardLayout, keyRange } from "../islands/keyboard.ts";

Deno.test("note names read as MIDI numbers", () => {
  assertEquals(midiFromName("C4"), 60);
  assertEquals(midiFromName("A4"), 69);
  assertEquals(midiFromName("F#4"), 66);
  assertEquals(midiFromName("C5"), 72);
  assertThrows(() => midiFromName("H4"));
  assertThrows(() => midiFromName("C"));
});

Deno.test("the twelve semitones split the colour wheel evenly", () => {
  assertEquals(hue(60), 0);
  assertEquals(hue(67), 210);
  // An octave apart is the same colour, which is the whole point of the mapping.
  assertEquals(hue(60), hue(72));
  assertEquals(solfa(60), "ド");
  assertEquals(isBlackKey(61), true);
  assertEquals(isBlackKey(62), false);
});

Deno.test("staff position counts diatonic steps, so sharps sit on their natural", () => {
  // A step is half a space: an octave is seven of them.
  assertEquals(staffStep(72) - staffStep(60), 7);
  assertEquals(staffStep(66), staffStep(65));
  assertEquals(staffStep(64) - staffStep(60), 2);
});

Deno.test("durations become note shapes", () => {
  assertEquals(noteShape(4), {
    filled: false,
    stem: false,
    flags: 0,
    dots: 0,
  });
  assertEquals(noteShape(2), {
    filled: false,
    stem: true,
    flags: 0,
    dots: 0,
  });
  assertEquals(noteShape(1), {
    filled: true,
    stem: true,
    flags: 0,
    dots: 0,
  });
  assertEquals(noteShape(0.5), {
    filled: true,
    stem: true,
    flags: 1,
    dots: 0,
  });
  assertEquals(noteShape(3), {
    filled: false,
    stem: true,
    flags: 0,
    dots: 1,
  });
  assertEquals(noteShape(1.75), {
    filled: true,
    stem: true,
    flags: 0,
    dots: 2,
  });
  assertThrows(() => noteShape(1.25));
});

Deno.test("every song fits on the keyboard it asks for", () => {
  for (const song of SONGS) {
    const { from, to } = keyRange(song.lowest, song.highest);
    const keys = keyboardLayout(from, to);
    const playable = new Set(keys.map((key) => key.midi));

    for (const note of song.notes) {
      assertEquals(
        playable.has(note.midi),
        true,
        `${song.title}: ${note.midi}`,
      );
      // Every note has to be writable, or the staff would throw mid-frame.
      noteShape(note.beats);
    }

    assertEquals(from, song.lowest - (isBlackKey(song.lowest) ? 1 : 0));
  }
});

Deno.test("silence is written with the same values as sound", () => {
  assertEquals(restShape(4), { value: "whole", dots: 0 });
  assertEquals(restShape(3), { value: "half", dots: 1 });
  assertEquals(restShape(2), { value: "half", dots: 0 });
  assertEquals(restShape(1.75), { value: "quarter", dots: 2 });
  assertEquals(restShape(1), { value: "quarter", dots: 0 });
  assertEquals(restShape(0.5), { value: "eighth", dots: 0 });
  assertEquals(restShape(0.25), { value: "sixteenth", dots: 0 });
  assertThrows(() => restShape(1.25), Error, "休符で書けない長さ");

  // Every value the reader can hand back has a glyph to draw it with.
  for (const value of ["whole", "half", "quarter", "eighth", "sixteenth"]) {
    assertEquals(typeof REST_GLYPHS[value as "whole"].path, "string");
  }
});

/** The rests of a melody, as `beat:value` with a dot per dot. */
function written(mml: string, beatsPerBar = 4): string[] {
  const melody = readMml(mml, beatsPerBar);
  return silences(melody.notes, beatsPerBar, melody.bars).map((rest) =>
    `${rest.beat}:${rest.value}${".".repeat(rest.dots)}`
  );
}

Deno.test("a melody with nothing to wait through has no rests", () => {
  assertEquals(written("o4 l4 | c d e f"), []);
});

Deno.test("a rest is as long as the silence, and starts on its own multiple", () => {
  assertEquals(written("o4 l4 | r c c c"), ["0:quarter"]);
  assertEquals(written("o4 l4 | c r r r"), ["1:quarter", "2:half"]);
  assertEquals(written("o4 l4 | r r c c"), ["0:half"]);
  assertEquals(written("o4 l4 | r2. c"), ["0:half."]);
  assertEquals(written("o4 l8 | c r c r c r c r"), [
    "0.5:eighth",
    "1.5:eighth",
    "2.5:eighth",
    "3.5:eighth",
  ]);
});

Deno.test("a bar with nothing in it is one whole rest, in any time signature", () => {
  assertEquals(written("o4 l4 | c c c c | r r r r"), ["4:whole"]);
  assertEquals(written("o4 l4 | c c c | r r r", 3), ["3:whole"]);
  assertEquals(written("o4 l4 | c c | r r", 2), ["2:whole"]);
});

Deno.test("a silence never runs across a bar line", () => {
  // Two and a half bars of nothing: a whole bar, then the halves either side of it.
  assertEquals(written("o4 l4 | c c c r | r r r r | r r c c"), [
    "3:quarter",
    "4:whole",
    "8:half",
  ]);
});

Deno.test("a rest in one part is not a rest while another part sounds", () => {
  // The lower voice rests through the bar; the upper one holds a whole note.
  assertEquals(written("o4 l4 | c1 , o3 l4 | r r r r"), []);
  // Both fall silent together, and only then is there something to draw.
  assertEquals(written("o4 l4 | c c r r , o3 l4 | c c r r"), ["2:half"]);
});

Deno.test("every song is covered by its notes and rests exactly once", () => {
  for (const song of SONGS) {
    const marks: [number, number][] = [
      ...song.notes.map((note: Note): [number, number] => [
        note.beat,
        note.beat + note.beats,
      ]),
      ...song.rests.map((rest): [number, number] => [
        rest.beat,
        rest.beat + rest.beats,
      ]),
    ].sort((a, b) => a[0] - b[0]);

    // A rest overlaps nothing, and between them nothing is left uncovered.
    let reached = 0;
    for (const [from, to] of marks) {
      assertEquals(from <= reached + 1e-9, true, `${song.id}: 穴 ${from}`);
      reached = Math.max(reached, to);
    }
    assertEquals(reached, song.bars * song.beatsPerBar, song.id);

    for (const rest of song.rests) {
      for (const note of song.notes) {
        const clash = note.beat < rest.beat + rest.beats - 1e-9 &&
          rest.beat < note.beat + note.beats - 1e-9;
        assertEquals(clash, false, `${song.id}: ${rest.beat}拍で重なる`);
      }
      // Every rest has to be drawable, or the staff would throw mid-frame.
      assertEquals(REST_GLYPHS[rest.value].line >= 4, true, song.id);
    }
  }
});
