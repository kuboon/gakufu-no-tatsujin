/**
 * The achievements, and what a play-through earns.
 *
 * One list, read twice. The page renders it into the `gamecenter.json` the hub
 * fetches, and the result screen reports against it — so a key can never exist
 * on one side only, which would be either an achievement nobody can earn or one
 * the hub has never heard of.
 *
 * What survives between plays lives here too, in `localStorage`: which songs
 * have been finished, the best score on each, and which achievements have come
 * up. All of it is a per-device convenience — enough to put a score on a song
 * card without a round trip. The record that counts is the hub's.
 */

import type { Result } from "./session.ts";
import { SONGS } from "./songs.ts";

/** One achievement, in the shape `gamecenter.json` declares. */
export interface Achievement {
  /** Unique within the game. What `unlock()` names. */
  key: string;
  title: string;
  description: string;
  points: number;
  /** Title and description stay hidden until it is unlocked. */
  hidden?: boolean;
}

/** The key that carries a score. Only the highest value ever reported is kept. */
export const SCORE_KEY = "high_score";

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    key: "clear_tulip",
    title: "はじめの いっぽ",
    description: "「さいた さいた」を最後まで弾く",
    points: 10,
  },
  {
    key: "clear_sakura",
    title: "花の もとにて",
    description: "「さくら さくら」を最後まで弾く",
    points: 15,
  },
  {
    key: "clear_5",
    title: "5曲 まわった",
    description: "5曲を最後まで弾く",
    points: 20,
  },
  {
    key: "clear_10",
    title: "10曲 まわった",
    description: "10曲を最後まで弾く",
    points: 30,
  },
  {
    key: "all_songs",
    title: "全曲 制覇",
    description: "収録曲すべてを最後まで弾く",
    points: 40,
  },
  {
    key: "combo_20",
    title: "20コンボ",
    description: "20回つづけて当てる",
    points: 15,
  },
  {
    key: "no_miss",
    title: "ひとつも 落とさない",
    description: "1曲をミスなしで弾ききる",
    points: 25,
  },
  {
    key: "all_perfect",
    title: "全部 バッチリ",
    description: "1曲を全部バッチリで弾ききる",
    points: 40,
  },
  {
    key: "rank_s",
    title: "楽譜の達人",
    description: "ランク S を取る",
    points: 30,
  },
  {
    key: SCORE_KEY,
    title: "自己最高",
    description: "自分のいちばん高い得点を記録する",
    points: 0,
  },
  {
    key: "listen_through",
    title: "みみで おぼえる",
    description: "おてほんで1曲を最後まで聞く",
    points: 5,
    hidden: true,
  },
];

/** An achievement a play-through earned, ready to report. */
export interface Earned {
  key: string;
  /** Present only on {@link SCORE_KEY}. */
  score?: number;
}

/** What this device remembers between plays. */
export interface Progress {
  /** Ids of the songs played to the end, without the demo player. */
  cleared: readonly string[];
  /** Highest score so far, over every song. */
  best: number;
  /** Highest score per song id — what a song card carries. */
  bests: Readonly<Record<string, number>>;
  /** Every achievement this device has earned, so the shelf has a count. */
  awards: readonly string[];
}

/** A device that has not played yet — and what the page is built with. */
export const NO_PROGRESS: Progress = {
  cleared: [],
  best: 0,
  bests: {},
  awards: [],
};

/** How many combos in a row the combo achievement asks for. */
const COMBO_TARGET = 20;

/** How many songs cleared earns which milestone, low to high. */
const MILESTONES: readonly (readonly [count: number, key: string])[] = [
  [5, "clear_5"],
  [10, "clear_10"],
];

const STORAGE_KEY = "gakufu:progress";

/**
 * What a finished play-through earns.
 *
 * Pure, and `before` is the state this device held *before* the play-through:
 * whether the last song of the set has just been finished, and whether the
 * score is a personal best, are both questions about what came before.
 *
 * @param result How the play-through ended
 * @param before What this device remembered before it
 * @returns The achievements to report, in the order to show them
 */
export function earned(result: Result, before: Progress): Earned[] {
  // The demo player is for listening, so it is never evidence of playing.
  if (result.usedAuto) return [{ key: "listen_through" }];

  const cleared = new Set([...before.cleared, result.song.id]);
  const keys: string[] = [];
  // Only the first songs carry an achievement of their own; the list has grown
  // since, and the rest count towards the milestones below instead.
  const own = `clear_${result.song.id}`;
  if (achievement(own) !== undefined) keys.push(own);
  // Counted against the songs on the list today, so a song that has since been
  // dropped cannot carry someone to a milestone.
  const standing = SONGS.filter((song) => cleared.has(song.id)).length;
  for (const [count, key] of MILESTONES) {
    if (standing >= count) keys.push(key);
  }
  if (SONGS.every((song) => cleared.has(song.id))) keys.push("all_songs");
  if (result.maxCombo >= COMBO_TARGET) keys.push("combo_20");
  if (result.miss === 0) keys.push("no_miss");
  if (result.miss === 0 && result.good === 0) keys.push("all_perfect");
  if (result.rank === "S") keys.push("rank_s");

  const won: Earned[] = keys.map((key) => ({ key }));
  // Only on a personal best, so an ordinary run does not put a claim link on
  // screen for a record it did not set.
  if (result.score > before.best) {
    won.push({ key: SCORE_KEY, score: result.score });
  }
  return won;
}

/** What this device remembers, or a clean slate when it cannot remember. */
export function readProgress(): Progress {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return NO_PROGRESS;
    const parsed = JSON.parse(stored) as Partial<Progress>;
    return {
      cleared: Array.isArray(parsed.cleared) ? parsed.cleared : [],
      best: typeof parsed.best === "number" ? parsed.best : 0,
      // Both were added after the first release, so a record written by an
      // older build is missing them rather than wrong.
      bests: typeof parsed.bests === "object" && parsed.bests !== null
        ? parsed.bests
        : {},
      awards: Array.isArray(parsed.awards) ? parsed.awards : [],
    };
  } catch {
    // A private window, or storage the browser will not hand over.
    return NO_PROGRESS;
  }
}

/**
 * Folds a play-through into what this device remembers.
 *
 * @param result How the play-through ended
 * @param previous What this device remembered before it
 * @param won What the play-through earned, from {@link earned}
 * @returns The progress including this play-through
 */
export function recordProgress(
  result: Result,
  previous: Progress,
  won: readonly Earned[] = [],
): Progress {
  const cleared = new Set(previous.cleared);
  if (!result.usedAuto) cleared.add(result.song.id);

  const score = result.usedAuto ? 0 : result.score;
  const awards = new Set(previous.awards);
  // Only keys the manifest declares, so trimming the achievement list can
  // never leave a phantom behind in the count.
  for (const entry of won) {
    if (achievement(entry.key) !== undefined) awards.add(entry.key);
  }

  const progress: Progress = {
    cleared: [...cleared],
    best: Math.max(previous.best, score),
    bests: {
      ...previous.bests,
      [result.song.id]: Math.max(previous.bests[result.song.id] ?? 0, score),
    },
    awards: [...awards],
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Nothing to do; the hub is where a record is meant to last anyway.
  }
  return progress;
}

/** Looks an achievement up by key. */
export function achievement(key: string): Achievement | undefined {
  return ACHIEVEMENTS.find((entry) => entry.key === key);
}
