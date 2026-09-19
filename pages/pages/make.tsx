import type { RemixNode } from "@remix-run/ui";

import { Link } from "../lib/link.tsx";
import { Maker } from "../islands/maker.tsx";

export const title = "曲をつくる — 楽譜の達人";
export const description =
  "MMLで旋律を書くと、その曲が遊べるリンクができます。和音も書けます。";

export const islands: readonly string[] = ["maker"];

export const lang = "ja";

export default function Make(): RemixNode {
  return (
    <>
      <h1>曲をつくる</h1>
      <p class="lead">
        旋律を書くと、その曲が遊べるリンクができます。曲は全部リンクの中に入っているので、
        送る先はどこでも構いませんし、こちらには何も保存されません。
      </p>
      <Maker />
      <p>
        できた曲は <Link href=".">楽譜の達人</Link>{" "}
        の曲一覧のいちばん上に出ます。リンクで届いた曲は実績にも記録にも入りません。
        書きかたの詳しい説明は <Link href="about">このサイトについて</Link>{" "}
        にもあります。
      </p>
    </>
  );
}
