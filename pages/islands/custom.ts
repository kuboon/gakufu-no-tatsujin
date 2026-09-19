/**
 * A melody carried in the page's own URL.
 *
 * `?mml=cde` is a whole song: everything the game needs about a melody is derivable from the
 * notation, so a link is enough to hand someone something to play. The editor at `/make` writes
 * these links, and this module is the one place that knows their shape — it reads them, writes
 * them, and turns one into a {@link Song}.
 *
 * Nothing that arrives this way counts. Whoever wrote the melody chose how hard it is, so a rank
 * or a record earned on it would be one they handed themselves; {@link Song.custom} is what says so
 * downstream.
 */

import type { ClefName } from "./clefs.ts";
import { type Song, song } from "./songs.ts";

/** What a link says about a melody. */
export interface CustomSpec {
  mml: string;
  title: string;
  /** The time signature's beats — the notation carries none. */
  beatsPerBar: number;
  clef: ClefName;
}

/** The id every URL melody plays under. No song on the list may take it. */
export const CUSTOM_ID = "custom";

/** What the title falls back to, so a link can be nothing but its notes. */
const UNTITLED = "じぶんの曲";

/** An empty melody — where the editor starts, and the shape of every default. */
export const BLANK: CustomSpec = {
  mml: "",
  title: "",
  beatsPerBar: 4,
  clef: "treble",
};

/** The most beats a bar may hold. Past this the notation is not saying anything a player reads. */
const MAX_BEATS_PER_BAR = 16;

/** How much of a title a card can show. A link may carry more; it will not be read. */
const MAX_TITLE = 40;

/** Either the song, or the one line that says why there is none. */
export type CustomResult = { song: Song } | { error: string };

/**
 * Reads the melody a query string carries, or null when it carries none.
 *
 * Anything malformed is left to {@link buildCustom} to complain about, so the editor can show the
 * link's own text back to whoever opened it alongside the reason it will not play.
 */
export function readSearch(search: string): CustomSpec | null {
  const params = new URLSearchParams(search);
  const mml = params.get("mml");
  if (mml === null) return null;

  const beats = params.get("beats");
  return {
    mml,
    title: params.get("title") ?? "",
    // NaN rather than a silent 4: a link that says something unreadable about its bars should say
    // so, not quietly play in a time signature nobody chose.
    beatsPerBar: beats === null ? 4 : Number(beats),
    clef: params.get("clef") === "bass" ? "bass" : "treble",
  };
}

/**
 * The query string that carries a melody.
 *
 * Only what differs from the defaults, so the short melody someone typed by hand stays a short
 * link. Whitespace goes entirely: it is there to make the notation readable while it is being
 * written, and a link is not read — the reader skips it, so `c d e` and `cde` are the same music,
 * and the shorter one is the one that survives being pasted into a message.
 *
 * This is safe for anything that reads at all. No token in the notation begins with a digit, so
 * closing a gap can never run two numbers together into a third.
 */
export function searchFor(spec: CustomSpec): string {
  const params = new URLSearchParams();
  params.set("mml", spec.mml.replace(/\s+/g, ""));
  if (spec.title.trim() !== "") params.set("title", spec.title.trim());
  if (spec.beatsPerBar !== BLANK.beatsPerBar) {
    params.set("beats", String(spec.beatsPerBar));
  }
  if (spec.clef !== BLANK.clef) params.set("clef", spec.clef);
  return `?${params}`;
}

/**
 * Builds the song, or says in one line why it cannot be built.
 *
 * The same {@link song} every entry on the list goes through, so a URL melody is held to the same
 * rules — it has to be readable, writable as note heads, and playable on the nine white keys. What
 * changes is only who reads the complaint: here it is whoever is writing the melody, so it comes
 * back as a message rather than as a thrown build error.
 */
export function buildCustom(spec: CustomSpec): CustomResult {
  const mml = spec.mml.trim();
  if (mml === "") return { error: "楽譜がまだ空です。" };
  if (
    !Number.isInteger(spec.beatsPerBar) ||
    spec.beatsPerBar < 1 ||
    spec.beatsPerBar > MAX_BEATS_PER_BAR
  ) {
    return { error: `1小節の拍数は1から${MAX_BEATS_PER_BAR}までの整数です。` };
  }

  const title = spec.title.trim().slice(0, MAX_TITLE);
  try {
    return {
      song: song({
        id: CUSTOM_ID,
        title: title === "" ? UNTITLED : title,
        credit: "URLでもらった楽譜",
        lead: "リンクで届いた曲。記録はのこりません。",
        difficulty: 0,
        beatsPerBar: spec.beatsPerBar,
        clef: spec.clef,
        mml,
        custom: true,
      }),
    };
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : String(cause) };
  }
}
