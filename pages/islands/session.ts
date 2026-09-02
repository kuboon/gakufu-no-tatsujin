/**
 * A play-through: the clock, the judging, and the frame loop that ties them together.
 *
 * Nothing here re-renders the page. The staff is drawn on a canvas and the keys are lit by toggling
 * a class on the elements they already have, so a whole song plays without the component tree
 * updating once — the island only re-renders when the *screen* changes.
 */

import type { Tones } from "./audio.ts";
import type { Song } from "./songs.ts";
import { Stage } from "./staff.ts";
import type { NoteState, NoteView } from "./staff.ts";

/** Within this of a note's moment, the hit is perfect. */
const PERFECT_SECONDS = 0.12;
/** Beyond this, the key press is not for that note at all. */
const GOOD_SECONDS = 0.26;
/** A note is missed once it is this far past. */
const MISS_SECONDS = 0.26;
/** How long before a note is due its key starts glowing. */
const CUE_SECONDS = 0.45;
/** Beats of silence before the first note, counted in. */
const COUNT_IN_BEATS = 4;
/** Held after the last note, so the ending has room to ring. */
const TAIL_SECONDS = 1.6;

const POINTS: Record<NoteState, number> = {
  pending: 0,
  perfect: 300,
  good: 100,
  miss: 0,
};

/** How a play-through ended. */
export interface Result {
  song: Song;
  /** Whether the demo player was on at any point, which rules out achievements. */
  usedAuto: boolean;
  score: number;
  maxCombo: number;
  perfect: number;
  good: number;
  miss: number;
  total: number;
  rank: string;
}

interface PlayNote extends NoteView {
  /** When it is due, in seconds on the game clock. */
  at: number;
}

export interface SessionOptions {
  song: Song;
  tones: Tones;
  /** Called once, when the last note has rung out. */
  onFinish: (result: Result) => void;
}

/** One play-through of one song. */
export class Session {
  readonly song: Song;
  #tones: Tones;
  #onFinish: (result: Result) => void;

  #notes: PlayNote[];
  #stage: Stage | null = null;
  #keys = new Map<number, HTMLElement>();
  #cued = new Set<number>();
  #held = new Set<number>();

  #secondsPerBeat: number;
  #origin = 0;
  #pausedAt: number | null = null;
  #running = false;
  #frame = 0;
  #auto = false;
  #autoUsed = false;

  #score = 0;
  #combo = 0;
  #maxCombo = 0;
  #counts: Record<NoteState, number> = {
    pending: 0,
    perfect: 0,
    good: 0,
    miss: 0,
  };
  #flash: { state: NoteState; at: number } | null = null;
  #nextTick = -COUNT_IN_BEATS;

  constructor(options: SessionOptions) {
    this.song = options.song;
    this.#tones = options.tones;
    this.#onFinish = options.onFinish;
    this.#secondsPerBeat = 60 / options.song.bpm;
    this.#notes = options.song.notes.map((note) => ({
      midi: note.midi,
      beat: note.beat,
      beats: note.beats,
      state: "pending",
      judgedAt: 0,
      at: 0,
    }));
  }

  /** How many beats of music are visible ahead of the judgement line. */
  get lookahead(): number {
    return this.song.beatsPerBar * 2;
  }

  /** Plays itself, for a demo or for a look at a song before trying it. */
  get auto(): boolean {
    return this.#auto;
  }

  set auto(on: boolean) {
    this.#auto = on;
    // Sticky: turning it back off does not make the notes you skipped yours.
    if (on) this.#autoUsed = true;
  }

  /** Takes over the canvas and starts the clock. Runs until the signal aborts. */
  attach(canvas: HTMLCanvasElement, signal: AbortSignal): void {
    this.#stage = new Stage(canvas);
    this.#stage.fit();

    // The first note starts one count-in bar after the music has scrolled in from the right edge.
    const leadIn = (this.lookahead + COUNT_IN_BEATS) * this.#secondsPerBeat;
    this.#origin = this.#tones.now() + leadIn;
    for (const note of this.#notes) {
      note.at = this.#origin + note.beat * this.#secondsPerBeat;
    }

    this.#running = true;
    const step = () => {
      if (signal.aborted) return;
      this.#tick();
      this.#frame = requestAnimationFrame(step);
    };
    this.#frame = requestAnimationFrame(step);

    globalThis.addEventListener("resize", () => this.#stage?.fit(), { signal });
    signal.addEventListener("abort", () => {
      cancelAnimationFrame(this.#frame);
      this.#running = false;
    });
  }

  /** Binds a key element so it can be lit without re-rendering. */
  bindKey(midi: number, element: HTMLElement, signal: AbortSignal): void {
    this.#keys.set(midi, element);
    signal.addEventListener("abort", () => {
      if (this.#keys.get(midi) === element) this.#keys.delete(midi);
    });
  }

  /** Plays a key: sounds it, and judges the note it was meant for. */
  press(midi: number): void {
    if (this.#held.has(midi)) return;
    this.#held.add(midi);
    this.#keys.get(midi)?.classList.add("is-down");

    const now = this.#tones.now();
    const target = this.#nearest(midi, now);
    this.#tones.note(midi, now, (target?.beats ?? 1) * this.#secondsPerBeat);

    if (target === undefined) return;
    const off = Math.abs(target.at - now);
    this.#judge(target, off <= PERFECT_SECONDS ? "perfect" : "good", now);
  }

  /** Releases a key. */
  release(midi: number): void {
    this.#held.delete(midi);
    this.#keys.get(midi)?.classList.remove("is-down");
  }

  /** Stops the clock while the phone is held the wrong way up. */
  setPaused(paused: boolean): void {
    if (!this.#running) return;
    if (paused && this.#pausedAt === null) {
      this.#pausedAt = this.#tones.now();
    } else if (!paused && this.#pausedAt !== null) {
      const stopped = this.#tones.now() - this.#pausedAt;
      this.#origin += stopped;
      for (const note of this.#notes) note.at += stopped;
      this.#pausedAt = null;
    }
  }

  /** Gives up on the play-through. */
  stop(): void {
    cancelAnimationFrame(this.#frame);
    this.#running = false;
    for (const midi of [...this.#held]) this.release(midi);
  }

  /** The nearest note of this pitch still waiting to be played. */
  #nearest(midi: number, now: number): PlayNote | undefined {
    let best: PlayNote | undefined;
    for (const note of this.#notes) {
      if (note.midi !== midi || note.state !== "pending") continue;
      const off = Math.abs(note.at - now);
      if (off > GOOD_SECONDS) continue;
      if (best === undefined || off < Math.abs(best.at - now)) best = note;
    }
    return best;
  }

  #judge(note: PlayNote, state: NoteState, now: number): void {
    note.state = state;
    note.judgedAt = now;
    this.#counts[state]++;
    this.#flash = { state, at: now };

    if (state === "miss") {
      this.#combo = 0;
      return;
    }
    this.#combo++;
    this.#maxCombo = Math.max(this.#maxCombo, this.#combo);
    this.#score += POINTS[state] + Math.min(this.#combo, 20) * 10;
  }

  #tick(): void {
    const stage = this.#stage;
    if (stage === null) return;

    const now = this.#pausedAt ?? this.#tones.now();
    const beat = (now - this.#origin) / this.#secondsPerBeat;

    this.#countIn(now, beat);

    for (const note of this.#notes) {
      if (note.state !== "pending") continue;
      if (this.#auto && note.at <= now) {
        this.#tones.note(note.midi, note.at, note.beats * this.#secondsPerBeat);
        this.#judge(note, "perfect", now);
      } else if (now - note.at > MISS_SECONDS) {
        this.#judge(note, "miss", now);
      }
    }

    this.#cue(now);

    const played = Math.max(0, beat) / (this.song.bars * this.song.beatsPerBar);
    stage.draw({
      now,
      beat,
      beatsPerBar: this.song.beatsPerBar,
      bars: this.song.bars,
      lookahead: this.lookahead,
      notes: this.#notes,
      clef: this.song.clef,
      score: this.#score,
      combo: this.#combo,
      bar: Math.min(
        this.song.bars,
        Math.max(1, Math.floor(beat / this.song.beatsPerBar) + 1),
      ),
      progress: Math.min(1, played),
      flash: this.#flash,
    });

    const last = this.#notes[this.#notes.length - 1];
    if (
      this.#running &&
      now > last.at + last.beats * this.#secondsPerBeat + TAIL_SECONDS
    ) {
      this.stop();
      this.#onFinish(this.#result());
    }
  }

  /** Ticks out the count-in bar, and marks every downbeat after it. */
  #countIn(now: number, beat: number): void {
    while (this.#nextTick <= beat) {
      const at = this.#origin + this.#nextTick * this.#secondsPerBeat;
      const downbeat = this.#nextTick % this.song.beatsPerBar === 0;
      if (this.#nextTick < 0) {
        this.#tones.tick(Math.max(at, now), downbeat);
        this.#nextTick += 1;
      } else {
        if (downbeat) this.#tones.tick(Math.max(at, now), false);
        this.#nextTick += this.song.beatsPerBar;
      }
    }
  }

  /** Lights the key of every note that is nearly due. */
  #cue(now: number): void {
    const due = new Set<number>();
    for (const note of this.#notes) {
      if (note.state !== "pending") continue;
      if (note.at - now < CUE_SECONDS && note.at - now > -MISS_SECONDS) {
        due.add(note.midi);
      }
    }

    for (const midi of this.#cued) {
      if (!due.has(midi)) this.#keys.get(midi)?.classList.remove("is-cued");
    }
    for (const midi of due) {
      if (!this.#cued.has(midi)) this.#keys.get(midi)?.classList.add("is-cued");
    }
    this.#cued = due;
  }

  #result(): Result {
    const total = this.#notes.length;
    const hit = this.#counts.perfect + this.#counts.good;
    const accuracy = total === 0
      ? 0
      : (this.#counts.perfect + hit) / (total * 2);
    return {
      song: this.song,
      usedAuto: this.#autoUsed,
      score: this.#score,
      maxCombo: this.#maxCombo,
      perfect: this.#counts.perfect,
      good: this.#counts.good,
      miss: this.#counts.miss,
      total,
      rank: accuracy >= 0.95
        ? "S"
        : accuracy >= 0.8
        ? "A"
        : accuracy >= 0.6
        ? "B"
        : "C",
    };
  }
}
