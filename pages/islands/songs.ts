/**
 * The songs, written in MML.
 *
 * Everything the rest of the game needs — the note times, the tempo, how many bars there are,
 * which keys the keyboard has to show — is derived from the MML, so adding a song is one entry
 * here. The notation itself lives in `mml.ts`.
 *
 * Every melody here is out of copyright: a folk tune of unknown authorship, or a composer who
 * died long enough ago. The credit line on each entry says which.
 */

import type { ClefName } from "./clefs.ts";
import { keyRange } from "./keyboard.ts";
import { readMml } from "./mml.ts";
import type { Note } from "./music.ts";

/** A playable melody. */
export interface Song {
  id: string;
  title: string;
  credit: string;
  /** One line for the song card. */
  lead: string;
  /** 1–3, shown as stars on the card. */
  difficulty: number;
  bpm: number;
  beatsPerBar: number;
  /** The clef the staff is drawn in. Treble unless a song sits too low for it. */
  clef: ClefName;
  notes: readonly Note[];
  bars: number;
  /** Range the keyboard has to cover. */
  lowest: number;
  highest: number;
}

interface SongSpec {
  id: string;
  title: string;
  credit: string;
  lead: string;
  difficulty: number;
  /** MML carries no time signature, so the beats of a bar are named here. */
  beatsPerBar: number;
  clef?: ClefName;
  mml: string;
}

function song(spec: SongSpec): Song {
  const { mml, clef = "treble", ...rest } = spec;
  const { notes, bars, bpm } = readMml(mml, spec.beatsPerBar);
  const pitches = notes.map((note) => note.midi);
  const lowest = Math.min(...pitches);
  const highest = Math.max(...pitches);

  // The keyboard is one fixed width for every song, so a song too wide for it
  // has to be caught here — at import, which means at build — rather than
  // narrowing the keys for everyone else.
  keyRange(lowest, highest);

  return { ...rest, clef, bpm, notes, bars, lowest, highest };
}

export const SONGS: readonly Song[] = [
  song({
    id: "tulip",
    title: "さいた さいた",
    credit: "チューリップ／近藤宮子 作詞・井上武士 作曲",
    lead: "ドレミだけで始まる、いちばんやさしい一曲。",
    difficulty: 1,
    beatsPerBar: 4,
    mml: `
      t104 l4 o4 | c d e2 | c d e2 | g e d c | d e d2
      | c d e2 | c d e2 | g e d c | d e c2
      | g g e g | a a g2 | e e d d | c1
    `,
  }),
  song({
    id: "chocho",
    title: "ちょうちょう",
    credit: "ドイツ民謡／野村秋足ほか 作詞",
    lead: "ソから下りてくる。ならんだ音をそのまま読む練習に。",
    difficulty: 1,
    beatsPerBar: 4,
    mml: `
      t108 l4 o4 | g e e2 | f d d2 | c d e f | g g g2
      | g e e2 | f d d2 | c e g g | e1
    `,
  }),
  song({
    id: "kaeru",
    title: "かえるのうた",
    credit: "ドイツ民謡／岡本敏明 訳詞",
    lead: "ドから順に上って、また下りる。休符のあいだも数える。",
    difficulty: 1,
    beatsPerBar: 4,
    mml: `
      t120 l4 o4 | c d e f | e d c2 | e f g a | g f e2
      | c r c r | c r c r | l8 c c d d e e f f | l4 e d c2
    `,
  }),
  song({
    id: "mary",
    title: "メリーさんのひつじ",
    credit: "アメリカ民謡（Mary Had a Little Lamb）",
    lead: "付点から入る、ミレドの行き来。",
    difficulty: 1,
    beatsPerBar: 4,
    mml: `
      t120 l4 o4 | e. d8 c d | e e e2 | d d d2 | e g g2
      | e. d8 c d | e e e e | d d e d | c1
    `,
  }),
  song({
    id: "kirakira",
    title: "きらきら星",
    credit: "フランス民謡（Ah! vous dirai-je, maman）",
    lead: "同じ音がふたつずつ。まずは高さだけを追えばいい。",
    difficulty: 1,
    beatsPerBar: 4,
    mml: `
      t112 l4 o4
      [ c c g g | a a g2 | f f e e | d d c2 ]1
      [ g g f f | e e d2 ]2
      c c g g | a a g2 | f f e e | d d c2
    `,
  }),
  song({
    id: "london",
    title: "ロンドン橋",
    credit: "イングランド民謡（London Bridge Is Falling Down）",
    lead: "2拍子。小節が短いので、小節線がすぐ次に来る。",
    difficulty: 2,
    beatsPerBar: 2,
    mml: `
      t120 l4 o4 | g8. a16 g8 f8 | e8 f8 g4 | d8 e8 f4 | e8 f8 g4
      | g8. a16 g8 f8 | e8 f8 g4 | d4 g4 | e8 c4.
    `,
  }),
  song({
    id: "saints",
    title: "聖者の行進",
    credit: "アメリカ民謡（When the Saints Go Marching In）",
    lead: "♩=180。休符から入る4音の出だしをそろえる。",
    difficulty: 2,
    beatsPerBar: 4,
    mml: `
      t180 l4 o4 r c e f | g1 | r c e f | g1
      | r c e f | g2 e2 | c2 e2 | d1
      | r e e d | c1 | e2 g2 | g f2.
      | r2 e f | g2 e2 | c2 d2 | c1
    `,
  }),
  song({
    id: "alps",
    title: "アルプス一万尺",
    credit: "アメリカ民謡（Yankee Doodle）",
    lead: "下のシまで下りる。加線の下に慣れる一曲。",
    difficulty: 2,
    beatsPerBar: 4,
    mml: `
      t132 l4 o4 | c c d e | c e d2 | c c d e | c2 <b2
      | >c c d e | f e d c | <b g a b | >c2 c2
    `,
  }),
  song({
    id: "birthday",
    title: "ハッピーバースデー",
    credit: "M. J. ヒル 作曲",
    lead: "3拍子。1拍の弱起から入り、ソからソまで1オクターブ動く。",
    difficulty: 2,
    beatsPerBar: 3,
    mml: `
      t112 l4 o4 g8. g16 | a g >c | <b2 g8. g16 | a g >d
      | c2 <g8. g16 | >g e c | <b a >f8. f16 | e c d | c2.
    `,
  }),
  song({
    id: "susanna",
    title: "オー・スザンナ",
    credit: "S. C. フォスター 作曲",
    lead: "弱起で入る。後半4小節がコーラス。",
    difficulty: 2,
    beatsPerBar: 4,
    mml: `
      t132 l4 o4 c8 d8 | e g g. a8 | g e c. d8 | e e d c | d2. c8 d8
      | e g g. a8 | g e c. d8 | e e d d | c2. r4
      | f f a. a8 | g g e. c8 | c d e e | d2 c2
    `,
  }),
  song({
    id: "sakura",
    title: "さくら さくら",
    credit: "日本古謡",
    lead: "都節の音階。加線の下のシまで下りて、最後は全音符でしめる。",
    difficulty: 2,
    beatsPerBar: 4,
    mml: `
      t72 l4 o4 | a a b2 | a a b2
      | a b >c <b | a b8 a8 f2
      | e c e f | e e8 c8 <b2
      | >a b >c <b | a b8 a8 f2
      | e c e f | e e8 c8 <b2
      | >a a b2 | a a b2
      | e f b8 a8 f | e1
    `,
  }),
  song({
    id: "jingle",
    title: "ジングルベル",
    credit: "J. L. ピアポント 作曲",
    lead: "♩=144。八分音符がはねるところが2か所ある。",
    difficulty: 2,
    beatsPerBar: 4,
    mml: `
      t144 l4 o4 | e e e2 | e e e2 | e g c. d8 | e1
      | f f f f | f e e e8 e8 | e d d e | d2 g2
      | e e e2 | e e e2 | e g c. d8 | e1
      | f f f f | f e e e8 e8 | g g f d | c1
    `,
  }),
];

/** Looks a song up by id, falling back to the first one. */
export function songById(id: string): Song {
  return SONGS.find((song) => song.id === id) ?? SONGS[0];
}
