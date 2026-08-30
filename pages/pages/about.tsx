import type { RemixNode } from "@remix-run/ui";

import { base } from "../lib/base.ts";
import { Link } from "../lib/link.tsx";
import { noteColor, solfa } from "../islands/music.ts";
import { Counter } from "../islands/counter.tsx";
import { Total } from "../islands/total.tsx";

export const title = "楽譜の達人について";
export const description =
  "遊びかたと、音に色を割り当てる決まり、そしてこのサイトのつくり。";

export const lang = "ja";

/** The island demo belongs here, next to the paragraph that explains it. */
export const islands: readonly string[] = ["counter", "total"];

/** One octave, C to B — the twelve hues, written out. */
const OCTAVE = Array.from({ length: 12 }, (_, semitone) => 60 + semitone);

/** How long each note value lasts, in beats. */
const VALUES: readonly (readonly [string, string])[] = [
  ["全音符", "4拍。白い丸、棒なし"],
  ["二分音符", "2拍。白い丸に棒"],
  ["四分音符", "1拍。黒い丸に棒"],
  ["八分音符", "半拍。黒い丸に棒と旗"],
];

export default function About(): RemixNode {
  return (
    <>
      <h1>楽譜の達人について</h1>
      <p class="lead">
        スマホを横に持って遊ぶリズムゲームです。画面の上半分を五線譜が右から左へ流れ、
        下半分の鍵盤で音を出します。音符が判定線に届いた瞬間に、同じ色の鍵盤を押してください。
      </p>

      <h2>音と色</h2>
      <p>
        1オクターブの十二の音に、色相環を十二等分した色をそのまま割り当てています。ドが赤、
        そこから半音上がるごとに30度ずつ色が回ります。同じ音は五線譜でも鍵盤でも同じ色なので、
        音名を読めなくても、色をたよりに弾けます。
      </p>
      <ul class="hues">
        {OCTAVE.map((midi) => (
          <li key={midi}>
            <span class="hue" style={`background:${noteColor(midi)}`}></span>
            {solfa(midi)}
          </li>
        ))}
      </ul>

      <h2>リズムの読みかた</h2>
      <p>
        リズムは二重に描かれます。音符が判定線に届く<em>
          タイミング
        </em>そのものと、 音符の<em>
          形
        </em>です。形が読めれば、次の小節を弾く前に長さが分かります。
        小節の区切りには縦線が引かれ、小節番号も添えてあります。
      </p>
      <ul class="features">
        {VALUES.map(([name, description]) => (
          <li key={name}>
            <strong>{name}</strong> — {description}
          </li>
        ))}
      </ul>

      <h2>このサイトのつくり</h2>
      <p>
        <code>
          router.ts
        </code>が三つのディレクトリを一つのハンドラーにまとめています。{" "}
        <code>islands/</code>はコード分割された一つのバンドルとして、<code>
          pages/
        </code>{" "}
        はこのサイト自身の変換を通して、<code>
          static/
        </code>はそのまま配信されます。
      </p>
      <p>
        <code>deno serve router.ts</code>{" "}
        はそのハンドラーを開発サーバーとして動かし、ビルドは同じオブジェクトを
        {" "}
        <code>fetch()</code>{" "}
        で叩いて、返ってきたものをディスクに書き、見つけたリンクをたどります。ゲームは
        その仕組みの上に載ったひとつのアイランドで、曲を選んだときと結果を出すときにしか
        再描画されません。演奏中の五線譜はキャンバス、鍵盤の光り具合はクラス名の付け外しです。
      </p>
      <div class="demo">
        <h3>アイランドは一度だけ束ねられる</h3>
        <p>
          下の二つは別々のブラウザーエントリーポイントで、直接は話しません。どちらも同じ
          クリック数のストアを読み込んでいて、合計が動くのは、そのモジュールが共有チャンクへ
          一度だけ出力されたからです。
        </p>
        <div class="demo-row">
          <Counter label="ひだり" start={0} />
          <Counter label="みぎ" start={0} />
          <Total label="合計" />
        </div>
      </div>

      <p>
        記事は<code>pages/blog/</code>のMarkdownです。{" "}
        <Link href={`${base}/blog`}>ブログ</Link>もどうぞ。
      </p>
      <p>
        <Link href={base === "" ? "/" : base}>← ゲームへ戻る</Link>
      </p>
    </>
  );
}
