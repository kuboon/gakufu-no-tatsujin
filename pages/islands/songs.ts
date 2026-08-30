/**
 * The songs, written as bars of note names.
 *
 * Everything the rest of the game needs — the note times, how many bars there are, which keys the
 * keyboard has to show — is derived from the score string, so adding a song is one entry here.
 */

import { type Note, readScore } from "./music.ts";

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
  bpm: number;
  beatsPerBar: number;
  score: string;
}

function song(spec: SongSpec): Song {
  const { score, ...rest } = spec;
  const { notes, bars } = readScore(score, spec.beatsPerBar);
  const pitches = notes.map((note) => note.midi);
  return {
    ...rest,
    notes,
    bars,
    lowest: Math.min(...pitches),
    highest: Math.max(...pitches),
  };
}

export const SONGS: readonly Song[] = [
  song({
    id: "tulip",
    title: "さいた さいた",
    credit: "チューリップ／近藤宮子 作詞・井上武士 作曲",
    lead: "ドレミだけで始まる、いちばんやさしい一曲。",
    difficulty: 1,
    bpm: 104,
    beatsPerBar: 4,
    score: `
      C4 D4 E4:2   | C4 D4 E4:2   | G4 E4 D4 C4 | D4 E4 D4:2 |
      C4 D4 E4:2   | C4 D4 E4:2   | G4 E4 D4 C4 | D4 E4 C4:2 |
      G4 G4 E4 G4  | A4 A4 G4:2   | E4 E4 D4 D4 | C4:4
    `,
  }),
  song({
    id: "koinu",
    title: "こいぬのマーチ",
    credit: "外国曲／久野静夫 作詞",
    lead: "八分音符がはねる行進曲。手はいそがしい。",
    difficulty: 3,
    bpm: 108,
    beatsPerBar: 4,
    score: `
      E4:.5 C4:.5 E4:.5 C4:.5 E4:.5 G4:.5 G4 | F4:.5 D4:.5 D4 E4:.5 C4:.5 C4 |
      E4:.5 C4:.5 E4:.5 C4:.5 E4:.5 G4:.5 G4 | F4:.5 D4:.5 D4 C4:2 |
      E4:.5 C4:.5 E4:.5 C4:.5 E4:.5 G4:.5 G4 | F4:.5 D4:.5 D4 E4:.5 C4:.5 C4 |
      E4:.5 C4:.5 E4:.5 C4:.5 E4:.5 G4:.5 G4 | F4:.5 D4:.5 D4 C4:2
    `,
  }),
  song({
    id: "sakura",
    title: "さくら さくら",
    credit: "日本古謡（みじかい版）",
    lead: "ゆっくり歌う都節。二分音符と全音符で息をつぐ。",
    difficulty: 2,
    bpm: 72,
    beatsPerBar: 4,
    score: `
      A4 A4 B4:2 | A4 A4 B4:2 | A4 B4 C5 B4 | A4 B4 A4:2 |
      A4 A4 B4:2 | A4 A4 B4:2 | A4 B4 A4 F4 | E4:4
    `,
  }),
];

/** Looks a song up by id, falling back to the first one. */
export function songById(id: string): Song {
  return SONGS.find((song) => song.id === id) ?? SONGS[0];
}
