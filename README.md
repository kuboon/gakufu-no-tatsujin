# 楽譜の達人 (gakufu-no-tatsujin)

音の高さを色で読む、スマホ横持ちのリズムゲーム。曲を選ぶと、画面の上半分を五線譜が右から左へ
流れ、下半分の鍵盤で音を出します。音符が判定線に届いた瞬間に、同じ色の鍵盤を押してください。

- **色**: 1オクターブの十二音に、色相環を十二等分した色を割り当てます。ドが赤、半音ごとに30度。
  同じ音は五線譜でも鍵盤でも同じ色なので、音名を読めなくても弾けます。
- **リズム**: 音符が判定線に届くタイミングと、音符の形（全音符・二分音符・四分音符・八分音符）の
  両方で表します。小節の区切りは縦線と小節番号で示します。
- **画面**: 横持ち前提。縦向きのときは「画面を よこ向きに してね」の案内が出て、演奏中なら
  時計も止まります。パソコンでは A〜L キー（黒鍵は Q〜P）でも弾けます。

収録曲は「さいた さいた（チューリップ）」「こいぬのマーチ」「さくら さくら」の3曲です。

## 開発

[Deno](https://deno.com) 2.x が必要です。

```sh
cd pages
deno task dev     # http://localhost:8000
deno task build   # 静的サイトを pages/dist に生成
deno task check   # 型・lint・フォーマット
```

サイトは [`pages/`](./pages) にあります。作りは
[`pages/README.md`](./pages/README.md) を参照してください。ゲーム本体は
`pages/islands/` にあるひとつのアイランドで、曲を足すには `pages/islands/songs.ts` に
1エントリ書き足すだけです。

```ts
song({
  id: "tulip",
  title: "さいた さいた",
  // …
  score: `C4 D4 E4:2 | C4 D4 E4:2 | G4 E4 D4 C4 | D4 E4 D4:2`,
});
```

`|` が小節、トークンが音（`:`のあとは拍数、既定は1拍）。小節の合計拍数が拍子と合わなければ
ビルドが失敗するので、書き間違いは静かに紛れ込みません。

## このリポジトリの土台

[Remix v3](https://remix.run) と
[`@kuboon/remix-ssg`](https://jsr.io/@kuboon/remix-ssg) の静的サイトスターターです。
サイトはコンテンツと、3つのディレクトリをひとつのハンドラーに束ねる `router.ts` だけで
できていて、`deno serve router.ts` が開発サーバー、ビルドは同じハンドラーを JSR から直接
クロールします。ビルドスクリプトはこのリポジトリにはありません。

## デプロイ

`.github/workflows/pages.yml` が再利用可能ワークフロー
`kuboon/workflows/.github/workflows/github-page-with-preview.yaml` を呼びます。`main` を
Pages のルートに、各プルリクエストをプレビュー用のサブパスに配置し、プレビューURLを
PRにコメントします。ビルドは [`mise`](https://mise.jdx.dev)（`mise.toml`）経由で Deno を
入れ、正しい `BASE_URL` で `deno task build` を実行します。

有効化するには: **Settings → Pages → Build and deployment → Source: GitHub Actions**。
