import type { RemixNode } from "@remix-run/ui";

import { ACHIEVEMENTS } from "../islands/achievements.ts";
import { AUTHOR, SLUG } from "../islands/gamecenter.ts";
import { Game } from "../islands/game.tsx";

export const title = "楽譜の達人 — 色で読む五線譜リズムゲーム";
export const description =
  "スマホを横に持って遊ぶリズムゲーム。十二の音に色相環の色を割り当て、右から左へ流れる五線譜を鍵盤で追いかけます。";

/** The game is one island, and the page is the frame it fills. */
export const islands: readonly string[] = ["game"];

/** Full-bleed: the game owns the whole viewport, so the site chrome steps aside. */
export const bare = true;

export const lang = "ja";

/**
 * What game-center reads off this page.
 *
 * The hub fetches this URL and looks for this script, so the page *is* the
 * registration: where the manifest was served from is what says it may be
 * written, and no token travels in either direction. The browser ignores a
 * `type` it does not know, so it costs the game nothing.
 */
const manifest = {
  $schema: "https://ga-cen.kbn.one/schema/gamecenter.json",
  id: SLUG,
  author: AUTHOR,
  title: "楽譜の達人",
  description:
    "音の高さを色で読む、スマホ横持ちのリズムゲーム。五線譜が右から左へ流れ、下半分の鍵盤で同じ色の鍵を押します。",
  icon: "static/favicon.svg",
  achievements: ACHIEVEMENTS,
};

export default function Home(): RemixNode {
  return (
    <>
      <script type="application/gamecenter+json">
        {JSON.stringify(manifest, null, 2)}
      </script>
      <Game />
    </>
  );
}
