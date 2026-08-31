import { assertEquals } from "@std/assert";

import {
  ACHIEVEMENTS,
  earned,
  type Progress,
  SCORE_KEY,
} from "../islands/achievements.ts";
import type { Result } from "../islands/session.ts";
import { songById, SONGS } from "../islands/songs.ts";

/** A finished play-through, perfect unless the test says otherwise. */
function played(over: Partial<Result> = {}): Result {
  const song = over.song ?? songById("tulip");
  return {
    song,
    usedAuto: false,
    score: 1000,
    maxCombo: song.notes.length,
    perfect: song.notes.length,
    good: 0,
    miss: 0,
    total: song.notes.length,
    rank: "S",
    ...over,
  };
}

const NOTHING: Progress = { cleared: [], best: 0 };

function keys(result: Result, before: Progress = NOTHING): string[] {
  return earned(result, before).map((entry) => entry.key);
}

Deno.test("every song has a clear achievement, and every key is declared once", () => {
  const declared = ACHIEVEMENTS.map((entry) => entry.key);
  assertEquals(new Set(declared).size, declared.length);
  for (const song of SONGS) {
    assertEquals(declared.includes(`clear_${song.id}`), true, song.id);
  }
});

Deno.test("the manifest's keys and points stay inside what the schema allows", () => {
  for (const entry of ACHIEVEMENTS) {
    assertEquals(
      /^[a-z0-9][a-z0-9_-]{0,62}[a-z0-9]$/.test(entry.key),
      true,
      entry.key,
    );
    assertEquals(
      entry.title.length > 0 && entry.title.length <= 100,
      true,
      entry.key,
    );
    assertEquals(entry.description.length <= 500, true, entry.key);
    assertEquals(
      Number.isInteger(entry.points) && entry.points >= 0,
      true,
      entry.key,
    );
  }
});

Deno.test("a flawless first play earns the clear, the combo and the run's quality", () => {
  assertEquals(keys(played()), [
    "clear_tulip",
    "combo_20",
    "no_miss",
    "all_perfect",
    "rank_s",
    SCORE_KEY,
  ]);
});

Deno.test("a miss costs the clean-run achievements but not the clear", () => {
  assertEquals(keys(played({ miss: 2, good: 3, rank: "A", maxCombo: 8 })), [
    "clear_tulip",
    SCORE_KEY,
  ]);
});

Deno.test("a run with only good hits is not perfect", () => {
  const won = keys(played({ good: 4, perfect: 10, rank: "A" }));
  assertEquals(won.includes("no_miss"), true);
  assertEquals(won.includes("all_perfect"), false);
});

Deno.test("the last unplayed song completes the set", () => {
  const before: Progress = { cleared: ["tulip", "koinu"], best: 0 };
  assertEquals(
    keys(played({ song: songById("sakura") }), before).includes("all_songs"),
    true,
  );
  // Still two to go: finishing one of them again does not complete anything.
  assertEquals(
    keys(played({ song: songById("tulip") }), before).includes("all_songs"),
    false,
  );
});

Deno.test("the score achievement waits for a personal best", () => {
  const before: Progress = { cleared: [], best: 1200 };
  assertEquals(keys(played({ score: 900 }), before).includes(SCORE_KEY), false);
  assertEquals(keys(played({ score: 1300 }), before).includes(SCORE_KEY), true);

  const [best] = earned(played({ score: 1300 }), before).filter((e) =>
    e.key === SCORE_KEY
  );
  assertEquals(best.score, 1300);
});

Deno.test("the demo player earns listening, and nothing else", () => {
  assertEquals(keys(played({ usedAuto: true })), ["listen_through"]);
});
