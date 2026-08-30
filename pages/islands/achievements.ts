/**
 * The achievements, and what a play-through earns.
 *
 * One list, read twice. The page renders it into the `gamecenter.json` the hub
 * fetches, and the result screen reports against it — so a key can never exist
 * on one side only, which would be either an achievement nobody can earn or one
 * the hub has never heard of.
 *
 * What survives between plays lives here too, in `localStorage`: which songs
 * have been finished, and the best score so far. Both are per-device
 * conveniences. The record that counts is the hub's.
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
    key: "clear_koinu",
    title: "はねる 八分音符",
    description: "「こいぬのマーチ」を最後まで弾く",
    points: 15,
  },
  {
    key: "clear_sakura",
    title: "花の もとにて",
    description: "「さくら さくら」を最後まで弾く",
    points: 15,
  },
  {
    key: "all_songs",
    title: "全曲 制覇",
    description: "3曲すべてを最後まで弾く",
    points: 30,
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
  /** Highest score so far. */
  best: number;
}

/** How many combos in a row the combo achievement asks for. */
const COMBO_TARGET = 20;

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
  const keys = [`clear_${result.song.id}`];
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
    if (stored === null) return { cleared: [], best: 0 };
    const parsed = JSON.parse(stored) as Partial<Progress>;
    return {
      cleared: Array.isArray(parsed.cleared) ? parsed.cleared : [],
      best: typeof parsed.best === "number" ? parsed.best : 0,
    };
  } catch {
    // A private window, or storage the browser will not hand over.
    return { cleared: [], best: 0 };
  }
}

/**
 * Folds a play-through into what this device remembers.
 *
 * @param result How the play-through ended
 * @param previous What this device remembered before it
 * @returns The progress including this play-through
 */
export function recordProgress(result: Result, previous: Progress): Progress {
  const cleared = new Set(previous.cleared);
  if (!result.usedAuto) cleared.add(result.song.id);

  const progress: Progress = {
    cleared: [...cleared],
    best: Math.max(previous.best, result.usedAuto ? 0 : result.score),
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
