import { assertEquals, assertThrows } from "@std/assert";

import {
  hue,
  isBlackKey,
  midiFromName,
  noteShape,
  solfa,
  staffStep,
} from "../islands/music.ts";
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
    assertEquals(
      song.notes[song.notes.length - 1].beat +
        song.notes[song.notes.length - 1].beats,
      song.bars * song.beatsPerBar,
    );
  }
});
