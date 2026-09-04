/**
 * game-center: the hub that keeps the achievements.
 *
 * There are two ways to the hub. A player who arrived through it carries a
 * launch token, and an unlock is recorded there and then. Anyone else — someone
 * who opened this game's own URL, or was offline — has nothing to authenticate
 * with, so the SDK queues the unlock and waits.
 *
 * The queue empties by itself if a token ever turns up. Otherwise it takes one
 * link, which records everything waiting at once. Nothing here opens that link:
 * a popup blocker would eat it, and a player should see what is about to be
 * recorded before it is. The result screen puts it on the page instead.
 */

import { GameCenter } from "@kuboon/game-center-sdk";

import type { Earned } from "./achievements.ts";

/**
 * The author's game-center handle, as the hub's `/me` page shows it.
 *
 * An opaque identifier rather than a name: the hub seeds it from the identity
 * provider's user id, so it is not something to derive from a GitHub login.
 */
export const AUTHOR = "7499d00d-fcff-4630-91a0-c034893c8d08";

/** The game's slug. Unique among this author's games rather than globally. */
export const SLUG = "gakufu-no-tatsujin";

export const HUB = "https://ga-cen.kbn.one";

/** The game's full name at the hub. */
export const GAME = `${AUTHOR}/${SLUG}`;

/** Where a player sees everything they have unlocked here. */
export const GAME_PAGE = `${HUB}/@${AUTHOR}/${SLUG}`;

/** What became of one reported achievement. */
export interface Recorded {
  key: string;
  /** True once the hub has it. False means it is waiting in the queue. */
  recorded: boolean;
}

/** What came back from reporting a play-through. */
export interface Reported {
  /** One entry per achievement reported, in the order given. */
  results: readonly Recorded[];
  /**
   * How many unlocks are waiting, this play-through's and any earlier one's.
   *
   * The queue outlives a session, so this can count achievements from plays
   * before this one — which is the point: one link records all of them.
   */
  pending: number;
  /** The link that records everything waiting, or null when nothing is. */
  claimUrl: string | null;
}

let client: GameCenter | null = null;

/** The SDK, created on first use so the server never touches it. */
function hub(): GameCenter {
  client ??= GameCenter.init({ gameId: GAME });
  return client;
}

/**
 * Reports everything a play-through earned.
 *
 * Unlocking is idempotent, so reporting the same achievement after every play
 * is fine: the hub keeps the first unlock, and the highest score.
 *
 * One at a time rather than in parallel — the SDK's queue is a single value it
 * rewrites on each unlock, and overlapping writes would lose one.
 *
 * @param won What the play-through earned
 * @returns What the hub took, and the one link for whatever it did not
 */
export async function report(won: readonly Earned[]): Promise<Reported> {
  const gc = hub();
  // Let the SDK look the player up and send anything left over from an earlier
  // session first, so what is queued below is only what is really outstanding.
  await gc.ready.catch(() => {});

  const results: Recorded[] = [];
  for (const { key, score } of won) {
    const result = await gc.unlock(key, score === undefined ? {} : { score });
    results.push({ key, recorded: result.recorded });
  }

  return { results, pending: gc.pending.length, claimUrl: gc.claimUrl() };
}
