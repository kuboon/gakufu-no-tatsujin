/**
 * The game: pick a song, then play it.
 *
 * This is the only island on the page, and it re-renders exactly three times a song — once per
 * screen. While a song is playing the staff belongs to a canvas and the keys light up through their
 * own class list, so the frame loop never touches the component tree.
 */

import { on, ref } from "@remix-run/ui";
import type { Handle, RemixNode } from "@remix-run/ui";
import { island } from "@kuboon/remix-ssg/client";

import {
  achievement,
  earned,
  readProgress,
  recordProgress,
} from "./achievements.ts";
import { Tones } from "./audio.ts";
import { GAME_PAGE, report, type Unlocked } from "./gamecenter.ts";
import {
  keyboardLayout,
  type KeyCap,
  keyRange,
  typingMap,
} from "./keyboard.ts";
import { keyColor, noteColor, solfa } from "./music.ts";
import { type Song, SONGS } from "./songs.ts";
import type { Result } from "./session.ts";
import { Session } from "./session.ts";

type Phase = "select" | "play" | "result";

/** Elements that lock the screen to landscape, where the browser lets a page ask. */
interface OrientationLock {
  lock?: (orientation: string) => Promise<void>;
}

export const Game = island(
  "game",
  "Game",
  function Game(handle: Handle<Record<never, never>>) {
    const tones = new Tones();

    let phase: Phase = "select";
    let song: Song = SONGS[0];
    let result: Result | null = null;
    let session: Session | null = null;
    let auto = false;
    let unlocked: Unlocked[] | null = null;

    // Held sideways is the only way to play, so a portrait phone stops the clock rather than
    // running the song out behind the notice.
    if (typeof globalThis.matchMedia === "function") {
      const portrait = globalThis.matchMedia("(orientation: portrait)");
      portrait.addEventListener(
        "change",
        (event) => session?.setPaused(event.matches),
        { signal: handle.signal },
      );
    }

    function keys(): KeyCap[] {
      const { from, to } = keyRange(song.lowest, song.highest);
      return keyboardLayout(from, to);
    }

    function play(chosen: Song): void {
      song = chosen;
      // The audio clock can only be started from a gesture, and this is one.
      void tones.unlock();
      session?.stop();
      session = new Session({ song, tones, onFinish: finish });
      session.auto = auto;
      result = null;
      unlocked = null;
      phase = "play";
      void handle.update();
    }

    function finish(finished: Result): void {
      result = finished;
      session = null;
      phase = "result";
      unlocked = null;
      void handle.update();
      void award(finished);
    }

    /**
     * Reports what the play-through earned, then shows what came back.
     *
     * The screen is already up by the time this runs: reaching the hub can
     * take a moment, and the score should not wait on it.
     */
    async function award(finished: Result): Promise<void> {
      const before = readProgress();
      const won = earned(finished, before);
      recordProgress(finished, before);
      if (won.length === 0) return;

      const results = await report(won);
      // A slow answer must not land on a screen that has moved on.
      if (result !== finished) return;
      unlocked = results;
      void handle.update();
    }

    function quit(): void {
      session?.stop();
      session = null;
      phase = "select";
      void handle.update();
    }

    function toggleAuto(): void {
      auto = !auto;
      if (session !== null) session.auto = auto;
      void handle.update();
    }

    async function goFullscreen(): Promise<void> {
      try {
        if (document.fullscreenElement === null) {
          await document.documentElement.requestFullscreen();
          await orientation()?.lock?.("landscape");
        } else {
          await document.exitFullscreen();
        }
      } catch {
        // Some browsers only allow this from within a fullscreen gesture, or not at all. The
        // rotate notice covers that case anyway.
      }
    }

    function orientation(): OrientationLock | undefined {
      return globalThis.screen?.orientation as OrientationLock | undefined;
    }

    /** Starts the frame loop, and lets a computer keyboard stand in for the touch one. */
    function attachStage(node: Element, signal: AbortSignal): void {
      const current = session;
      if (current === null) return;
      current.attach(node as HTMLCanvasElement, signal);

      const typed = typingMap(keys());
      globalThis.addEventListener("keydown", (event) => {
        if (event.repeat || event.metaKey || event.ctrlKey) return;
        if (event.key === "Escape") {
          quit();
          return;
        }
        const midi = typed.get(event.key.toLowerCase());
        if (midi !== undefined) {
          event.preventDefault();
          current.press(midi);
        }
      }, { signal });

      globalThis.addEventListener("keyup", (event) => {
        const midi = typed.get(event.key.toLowerCase());
        if (midi !== undefined) current.release(midi);
      }, { signal });
    }

    function autoButton(): RemixNode {
      return (
        <button
          type="button"
          class={auto ? "toggle is-on" : "toggle"}
          aria-pressed={auto ? "true" : "false"}
          mix={[on("click", toggleAuto)]}
        >
          おてほん
        </button>
      );
    }

    function selectScreen(): RemixNode {
      return (
        <section class="select">
          <header class="select__head">
            <h1 class="select__title">楽譜の達人</h1>
            <p class="select__lead">
              音の高さは色でおぼえる。流れてくる音符の形とタイミングでリズムを読む。
            </p>
          </header>
          <ul class="songs">
            {SONGS.map((choice) => (
              <li key={choice.id}>
                <button
                  type="button"
                  class="song"
                  mix={[on("click", () => play(choice))]}
                >
                  <span class="song__title">{choice.title}</span>
                  <span class="song__credit">{choice.credit}</span>
                  <span class="song__lead">{choice.lead}</span>
                  <span class="song__colors">
                    {scaleOf(choice).map((midi) => (
                      <span
                        key={midi}
                        class="dot"
                        style={`background:${noteColor(midi)}`}
                        title={solfa(midi)}
                      >
                      </span>
                    ))}
                  </span>
                  <span class="song__meta">
                    <span class="song__stars">{stars(choice.difficulty)}</span>
                    <span>{choice.bars}小節</span>
                    <span>♩={choice.bpm}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <footer class="select__foot">
            {autoButton()}
            <button
              type="button"
              class="toggle"
              mix={[on("click", () => void goFullscreen())]}
            >
              全画面
            </button>
            <a
              class="toggle"
              href={GAME_PAGE}
              target="_blank"
              rel="noopener"
            >
              実績
            </a>
            <span class="select__hint">
              スマホは横向き・パソコンは A〜L キーでも弾けます
            </span>
          </footer>
        </section>
      );
    }

    function playScreen(): RemixNode {
      return (
        <section class="play">
          <div class="stage">
            <canvas class="stage__canvas" mix={[ref(attachStage)]}></canvas>
            <div class="stage__bar">
              {autoButton()}
              <button
                type="button"
                class="toggle"
                aria-label="曲をえらぶ"
                mix={[on("click", quit)]}
              >
                ✕
              </button>
            </div>
          </div>
          <div class="keyboard">
            {keys().map((key) => (
              <button
                key={key.midi}
                type="button"
                class={key.black ? "key key--black" : "key"}
                style={`left:${percent(key.left)};width:${
                  percent(key.width)
                };--face:${keyColor(key.midi)}`}
                aria-label={solfa(key.midi)}
                mix={[
                  ref((node, signal) =>
                    session?.bindKey(key.midi, node as HTMLElement, signal)
                  ),
                  on("pointerdown", (event) => {
                    event.preventDefault();
                    session?.press(key.midi);
                  }),
                  on("pointerup", () => session?.release(key.midi)),
                  on("pointercancel", () => session?.release(key.midi)),
                  on("pointerleave", () => session?.release(key.midi)),
                ]}
              >
                <span class="key__label">{solfa(key.midi)}</span>
              </button>
            ))}
          </div>
        </section>
      );
    }

    /**
     * What the play-through earned.
     *
     * An achievement the hub could not take on its own comes back with a claim
     * URL, and that URL is the chip itself: a link the player chose to follow
     * survives a popup blocker, and shows them what is about to be recorded.
     */
    function awards(): RemixNode {
      if (unlocked === null || unlocked.length === 0) return null;

      return (
        <ul class="awards">
          {unlocked.map((entry) => {
            const won = achievement(entry.key);
            if (won === undefined) return null;
            const label = (
              <>
                <span class="award__title">{won.title}</span>
                {won.points > 0
                  ? <span class="award__points">+{won.points}</span>
                  : null}
              </>
            );

            return (
              <li key={entry.key} class="award">
                {entry.recorded
                  ? <span class="award__chip is-recorded">{label}</span>
                  : (
                    <a
                      class="award__chip"
                      href={entry.claimUrl}
                      target="_blank"
                      rel="noopener"
                    >
                      {label}
                      <span class="award__claim">記録する</span>
                    </a>
                  )}
              </li>
            );
          })}
        </ul>
      );
    }

    function resultScreen(): RemixNode {
      const summary = result;
      if (summary === null) return selectScreen();

      return (
        <section class="result">
          <p class="result__rank">{summary.rank}</p>
          <h2 class="result__title">{summary.song.title}</h2>
          <p class="result__score">
            {summary.score}
            <small>てん</small>
          </p>
          <ul class="result__stats">
            <li>
              <span>バッチリ</span>
              <strong>{summary.perfect}</strong>
            </li>
            <li>
              <span>ナイス</span>
              <strong>{summary.good}</strong>
            </li>
            <li>
              <span>ミス</span>
              <strong>{summary.miss}</strong>
            </li>
            <li>
              <span>最大コンボ</span>
              <strong>{summary.maxCombo}</strong>
            </li>
          </ul>
          {awards()}
          <div class="result__actions">
            <button
              type="button"
              class="primary"
              mix={[on("click", () => play(summary.song))]}
            >
              もういちど
            </button>
            <button type="button" class="toggle" mix={[on("click", quit)]}>
              ほかの曲
            </button>
          </div>
        </section>
      );
    }

    return () => (
      <div class="game">
        {phase === "select"
          ? selectScreen()
          : phase === "play"
          ? playScreen()
          : resultScreen()}
        <div class="rotate">
          <div class="rotate__phone" aria-hidden="true"></div>
          <p class="rotate__text">画面を よこ向きに してね</p>
        </div>
      </div>
    );
  },
);

/** The pitches a song uses, low to high — the colours on its card. */
function scaleOf(song: Song): number[] {
  return [...new Set(song.notes.map((note) => note.midi))].sort((a, b) =>
    a - b
  );
}

function stars(difficulty: number): string {
  return "★".repeat(difficulty) + "☆".repeat(3 - difficulty);
}

function percent(fraction: number): string {
  return `${(fraction * 100).toFixed(4)}%`;
}
