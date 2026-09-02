import { assertEquals } from "@std/assert";

import { type ClefName, CLEFS } from "../islands/clefs.ts";
import { staffStep } from "../islands/music.ts";
import { SONGS } from "../islands/songs.ts";

/** How far above the bottom line a pitch sits, in half-spaces. */
function stepsAbove(clef: ClefName, midi: number): number {
  return staffStep(midi) - staffStep(CLEFS[clef].bottom);
}

Deno.test("a clef names a pitch on one of the five lines", () => {
  for (const [name, clef] of Object.entries(CLEFS)) {
    const step = stepsAbove(name as ClefName, clef.anchor);
    // Even steps are lines, odd ones spaces; the staff is steps 0 to 8.
    assertEquals(step % 2, 0, name);
    assertEquals(step >= 0 && step <= 8, true, name);
    assertEquals(clef.path.startsWith("M"), true, name);
  }
});

Deno.test("the treble G and the bass F land where they are written", () => {
  // G on the second line up, F on the fourth.
  assertEquals(stepsAbove("treble", CLEFS.treble.anchor), 2);
  assertEquals(stepsAbove("bass", CLEFS.bass.anchor), 6);
});

Deno.test("every song reads within three ledger lines of its clef", () => {
  for (const song of SONGS) {
    for (const note of song.notes) {
      const step = stepsAbove(song.clef, note.midi);
      assertEquals(
        step >= -6 && step <= 14,
        true,
        `${song.id}: ${note.midi} sits ${step} steps above the bottom line`,
      );
    }
  }
});
