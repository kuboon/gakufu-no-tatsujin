import type { RemixNode } from "@remix-run/ui";

import { Game } from "../islands/game.tsx";

export const title = "楽譜の達人 — 色で読む五線譜リズムゲーム";
export const description =
  "スマホを横に持って遊ぶリズムゲーム。十二の音に色相環の色を割り当て、右から左へ流れる五線譜を鍵盤で追いかけます。";

/** The game is one island, and the page is the frame it fills. */
export const islands: readonly string[] = ["game"];

/** Full-bleed: the game owns the whole viewport, so the site chrome steps aside. */
export const bare = true;

export const lang = "ja";

export default function Home(): RemixNode {
  return <Game />;
}
