/**
 * game-center: the hub that keeps the achievements.
 *
 * The SDK tries three ways of reaching it and takes the first that works —
 * posting to the embedding page, calling the API with the launch token the hub
 * left in the URL, and finally handing back a claim URL for the player to
 * confirm themselves. Only the first two record anything on their own, so
 * whatever comes back unrecorded has to reach the screen as a link.
 *
 * Nothing here opens that link. A popup blocker would eat it, and a player
 * should see what is about to be recorded before it is.
 */

import { GameCenter } from "@kuboon/game-center-sdk";

import type { Earned } from "./achievements.ts";

/**
 * The author's game-center handle, as the hub's `/me` page shows it.
 *
 * TODO: replace with the real handle. It is an opaque identifier that only the
 * author can read off the hub, and the registration fails with a 404 until it
 * names an account that exists.
 */
export const AUTHOR = "REPLACE-WITH-YOUR-GAME-CENTER-HANDLE";

/** The game's slug. Unique among this author's games rather than globally. */
export const SLUG = "gakufu-no-tatsujin";

export const HUB = "https://ga-cen.kbn.one";

/** The game's full name at the hub. */
export const GAME = `${AUTHOR}/${SLUG}`;

/** Where a player sees everything they have unlocked here. */
export const GAME_PAGE = `${HUB}/@${AUTHOR}/${SLUG}`;

/** What became of one reported achievement. */
export interface Unlocked {
  key: string;
  /** True once the hub has it. False means {@link claimUrl} is the next step. */
  recorded: boolean;
  /** Where the player confirms it themselves. */
  claimUrl?: string;
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
 * @param won What the play-through earned
 * @returns One entry per achievement, in the order given
 */
export function report(won: readonly Earned[]): Promise<Unlocked[]> {
  return Promise.all(won.map(async ({ key, score }) => {
    const result = await hub().unlock(
      key,
      score === undefined ? {} : { score },
    );
    return { key, recorded: result.recorded, claimUrl: result.claimUrl };
  }));
}
