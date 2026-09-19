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
  ACHIEVEMENTS,
  earned,
  NO_PROGRESS,
  type Progress,
  readProgress,
  recordProgress,
} from "./achievements.ts";
import { Tones } from "./audio.ts";
import { buildCustom, readSearch } from "./custom.ts";
import { GAME_PAGE, report, type Reported } from "./gamecenter.ts";
import {
  keyboardLayout,
  type KeyCap,
  keyRange,
  typingMap,
} from "./keyboard.ts";
import { listenMidi, midiSupported } from "./midi.ts";
import { glowColor, keyColor, noteColor, solfa } from "./music.ts";
import { type Song, SONGS } from "./songs.ts";
import type { Result } from "./session.ts";
import { Session } from "./session.ts";

type Phase = "select" | "play" | "result";

/** The white keys of one octave — the colour legend on the song list. */
const LEGEND = [60, 62, 64, 65, 67, 69, 71];

/**
 * What marks an `<a>` as leaving this page for another document.
 *
 * The client runtime would otherwise treat a same-site link as a navigation to handle itself, and
 * this site is a set of separately built pages rather than one app. Not in the JSX prop types,
 * which is why it is spread rather than written.
 */
const DOCUMENT_LINK = { "rmx-document": "" } as Record<string, string>;

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
    let reported: Reported | null = null;
    // Whether the run on screen beat this device's record for that song.
    let beatBest = false;
    // What this device remembers, once there is a browser to ask. The page is
    // built ahead of time, so the first render has to be the blank one every
    // visitor's HTML carries; the real record arrives a beat later.
    let progress: Progress | null = null;
    // The melody this page's own URL carries, if it carries one, and why it
    // could not be read if it could not. Both wait for a browser: there is no
    // query string at build time, and a card that appeared out of nowhere
    // would disagree with the HTML every visitor is served.
    let custom: Song | null = null;
    let customError: string | null = null;
    // How far the player has got with a MIDI keyboard, if they asked for one.
    // "unknown" until there is a browser to ask, for the same reason the record
    // above is: the page is built ahead of time, and whether Web MIDI exists is
    // not something the build can answer.
    let midi:
      | "unknown"
      | "unsupported"
      | "off"
      | "asking"
      | "on"
      | "refused" = "unknown";
    let instruments: readonly string[] = [];

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

    /**
     * Reads what only a browser can answer, the first time this runs in one.
     *
     * The stored record, and whether this browser has Web MIDI at all. Both
     * have to wait for the page to be live: rendering either on the first pass
     * would disagree with the HTML the build wrote, which is a hydration
     * mismatch rather than a difference of opinion.
     */
    function readDevice(): void {
      if (progress !== null) return;
      progress = readProgress();
      midi = midiSupported() ? "off" : "unsupported";

      const spec = readSearch(globalThis.location?.search ?? "");
      if (spec !== null) {
        const built = buildCustom(spec);
        if ("song" in built) custom = built.song;
        else customError = built.error;
      }
      void handle.update();
    }

    /**
     * Connects a MIDI keyboard, on the press of the button that offers it.
     *
     * Asked for rather than assumed: the browser answers with a permission
     * prompt, and one that appears unbidden on a game's front page is a good
     * way to be refused for good. The notes go to whichever song is playing
     * when they arrive, so this outlives any one play-through.
     */
    async function connectMidi(): Promise<void> {
      if (midi === "asking" || midi === "on") return;
      midi = "asking";
      void handle.update();

      const granted = await listenMidi({
        press: (note) => session?.press(note),
        release: (note) => session?.release(note),
        devices: (names) => {
          instruments = names;
          void handle.update();
        },
      }, handle.signal);

      midi = granted ? "on" : "refused";
      void handle.update();
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
      reported = null;
      phase = "play";
      void handle.update();
    }

    function finish(finished: Result): void {
      // Read before anything is written: whether this is a personal best is a
      // question about the record that stood when the song started.
      const before = progress ?? readProgress();
      beatBest = !finished.usedAuto && finished.song.custom !== true &&
        finished.score > (before.bests[finished.song.id] ?? 0);
      result = finished;
      session = null;
      phase = "result";
      reported = null;
      void handle.update();
      void award(finished, before);
    }

    /**
     * Reports what the play-through earned, then shows what came back.
     *
     * The screen is already up by the time this runs: reaching the hub can
     * take a moment, and the score should not wait on it.
     */
    async function award(finished: Result, before: Progress): Promise<void> {
      const won = earned(finished, before);
      progress = recordProgress(finished, before, won);
      if (won.length === 0) return;

      const answer = await report(won);
      // A slow answer must not land on a screen that has moved on.
      if (result !== finished) return;
      reported = answer;
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

    /**
     * The MIDI keyboard's one control, and everything it has to say.
     *
     * Absent where the browser has no Web MIDI — Safari never shipped it —
     * because a button that cannot work is worse than no button.
     */
    function midiButton(): RemixNode {
      if (midi === "unknown" || midi === "unsupported") return null;

      const label = midi === "on"
        ? (instruments.length > 0 ? instruments[0] : "つないでください")
        : midi === "asking"
        ? "きいています…"
        : midi === "refused"
        ? "ゆるされませんでした"
        : "MIDIキーボード";

      return (
        <button
          type="button"
          class={midi === "on" && instruments.length > 0
            ? "toggle is-on"
            : "toggle"}
          aria-pressed={midi === "on" ? "true" : "false"}
          disabled={midi === "asking" || midi === "on"}
          title={midi === "on" && instruments.length > 1
            ? instruments.join("、")
            : undefined}
          mix={[on("click", () => void connectMidi())]}
        >
          {label}
        </button>
      );
    }

    function fullscreenButton(): RemixNode {
      return (
        <button
          type="button"
          class="toggle"
          mix={[on("click", () => void goFullscreen())]}
        >
          全画面
        </button>
      );
    }

    /**
     * The song list.
     *
     * The grid fills the width rather than fixing a column count: there are
     * three songs today and there will be more, and the list is meant to grow
     * downwards into a scroll rather than squeeze.
     */
    function selectScreen(): RemixNode {
      const record = progress ?? NO_PROGRESS;

      return (
        <section class="select">
          <header class="select__head">
            <div>
              <h1 class="select__title">楽譜の達人</h1>
              <p class="select__lead">
                音の高さは色。流れてくる音符と同じ色の鍵をおす。
              </p>
            </div>
            <div class="legend">
              <span class="legend__label">音と色</span>
              <span class="legend__keys">
                {LEGEND.map((midi) => (
                  <span
                    key={midi}
                    class="legend__key"
                    style={`--face:${noteColor(midi)}`}
                  >
                    {solfa(midi)}
                  </span>
                ))}
              </span>
            </div>
          </header>

          <div class="select__body">
            <ul class="songs" mix={[ref(readDevice)]}>
              {customCard()}
              {SONGS.map((choice) => (
                <li key={choice.id}>
                  <button
                    type="button"
                    class="song"
                    title={choice.lead}
                    mix={[on("click", () => play(choice))]}
                  >
                    <span class="song__head">
                      <span class="song__title">{choice.title}</span>
                      <span class="song__stars">
                        {stars(choice.difficulty)}
                      </span>
                    </span>
                    <span class="song__credit">
                      {choice.bars}小節・{choice.credit}
                    </span>
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
                    <span class="song__spacer"></span>
                    {songState(choice, record)}
                  </button>
                </li>
              ))}
            </ul>
            <div class="select__fade" aria-hidden="true"></div>
          </div>

          <footer class="select__foot">
            <div class="select__side">
              {autoButton()}
              {midiButton()}
              <a class="toggle" href="make" {...DOCUMENT_LINK}>
                曲をつくる
              </a>
              <span class="select__hint">
                スマホは横向き・パソコンは A〜L キーでも弾けます
              </span>
            </div>
            <div class="select__side">
              <a
                class="toggle is-award"
                href={GAME_PAGE}
                target="_blank"
                rel="noopener"
              >
                実績
                <span class="toggle__count">
                  {record.awards.length} / {ACHIEVEMENTS.length}
                </span>
              </a>
              {fullscreenButton()}
            </div>
          </footer>
        </section>
      );
    }

    /**
     * The card for the melody this page's URL carried, at the top of the list.
     *
     * Present only when there is one, which is why it is a card rather than a
     * screen of its own: a link hands someone a melody, and the rest of the
     * list is still there to play afterwards. A link that cannot be read shows
     * the reason and a way into the editor with the same notation loaded, so
     * the fix is one page away.
     */
    function customCard(): RemixNode {
      if (customError !== null) {
        return (
          <li key="custom" class="songs__custom">
            <div class="song song--broken">
              <span class="song__head">
                <span class="song__title">URLの楽譜が読めません</span>
              </span>
              <span class="song__credit">{customError}</span>
              <span class="song__spacer"></span>
              <a
                class="song__state"
                href={`make${globalThis.location?.search ?? ""}`}
                {...DOCUMENT_LINK}
              >
                なおす
              </a>
            </div>
          </li>
        );
      }

      const mine = custom;
      if (mine === null) return null;

      return (
        <li key="custom" class="songs__custom">
          <button
            type="button"
            class="song song--custom"
            title={mine.lead}
            mix={[on("click", () => play(mine))]}
          >
            <span class="song__head">
              <span class="song__title">{mine.title}</span>
              <span class="song__badge">URLの曲</span>
            </span>
            <span class="song__credit">
              {mine.bars}小節・♩={mine.bpm}
            </span>
            <span class="song__colors">
              {scaleOf(mine).map((midi) => (
                <span
                  key={midi}
                  class="dot"
                  style={`background:${noteColor(midi)}`}
                  title={solfa(midi)}
                >
                </span>
              ))}
            </span>
            <span class="song__spacer"></span>
            <span class="song__state">
              <span aria-hidden="true">▷</span>
              記録はのこりません
            </span>
          </button>
        </li>
      );
    }

    /** The one line under a song card: never played, or cleared and the best score. */
    function songState(choice: Song, record: Progress): RemixNode {
      const best = record.bests[choice.id] ?? 0;
      if (!record.cleared.includes(choice.id)) {
        return (
          <span class="song__state">
            <span aria-hidden="true">▷</span>
            はじめて
          </span>
        );
      }
      return (
        <span class="song__state is-cleared">
          <span aria-hidden="true">✓</span>
          クリア
          {best > 0
            ? <span class="song__best">{best.toLocaleString("ja-JP")}</span>
            : null}
        </span>
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
                class="stage__quit"
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
                };--face:${keyColor(key.midi)};--cue:${
                  noteColor(key.midi)
                };--glow:${glowColor(key.midi)}`}
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
     * A chip per achievement, saying whether the hub has it. Whatever it could
     * not take is waiting in the SDK's queue, and one link at the end records
     * all of it — including anything left over from an earlier play. The link
     * is a link the player chooses to follow, never a window this page opens.
     */
    function awards(): RemixNode {
      if (reported === null || reported.results.length === 0) return null;
      const answer = reported;

      return (
        <div class="awards">
          <span class="awards__label">もらった実績</span>
          <ul class="awards__list">
            {answer.results.map((entry) => {
              const won = achievement(entry.key);
              if (won === undefined) return null;

              return (
                <li key={entry.key}>
                  <span
                    class={entry.recorded
                      ? "award__chip is-recorded"
                      : "award__chip is-waiting"}
                  >
                    <span class="award__title">{won.title}</span>
                    {won.points > 0
                      ? <span class="award__points">+{won.points}</span>
                      : null}
                  </span>
                </li>
              );
            })}
          </ul>
          {answer.claimUrl !== null
            ? (
              <a
                class="award__chip awards__claim"
                href={answer.claimUrl}
                target="_blank"
                rel="noopener"
              >
                実績を記録する
                <span class="award__points">{answer.pending}件</span>
              </a>
            )
            : null}
        </div>
      );
    }

    function resultScreen(): RemixNode {
      const summary = result;
      if (summary === null) return selectScreen();
      const next = nextSong(summary.song);

      return (
        <section class="result">
          <div class="result__rank">
            <span class="result__rank-label">ランク</span>
            <span class="result__grade">{summary.rank}</span>
            <span class="result__score">
              <strong>{summary.score.toLocaleString("ja-JP")}</strong>
              <span>てん</span>
            </span>
            {beatBest ? <span class="result__best">自己ベスト更新</span> : null}
          </div>

          <div class="result__main">
            <div>
              <h2 class="result__title">{summary.song.title}</h2>
              <p class="result__note">{verdict(summary)}</p>
            </div>

            <ul class="result__stats">
              <li class="is-perfect">
                <span>バッチリ</span>
                <strong>{summary.perfect}</strong>
              </li>
              <li class="is-good">
                <span>ナイス</span>
                <strong>{summary.good}</strong>
              </li>
              <li class="is-miss">
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
                mix={[on("click", () => play(next))]}
              >
                つぎの曲：{next.title}
              </button>
              <button
                type="button"
                class="toggle"
                mix={[on("click", () => play(summary.song))]}
              >
                もういちど
              </button>
              <button type="button" class="toggle" mix={[on("click", quit)]}>
                曲をえらぶ
              </button>
            </div>
          </div>
        </section>
      );
    }

    /** The notice a portrait phone gets instead of the game. */
    function rotateScreen(): RemixNode {
      return (
        <div class="rotate">
          <div class="rotate__brand">
            <p class="rotate__title">楽譜の達人</p>
            <div class="rotate__hues">
              {LEGEND.map((midi) => (
                <span
                  key={midi}
                  class="dot"
                  style={`background:${noteColor(midi)}`}
                >
                </span>
              ))}
            </div>
          </div>
          <div class="rotate__middle">
            <div class="rotate__phone" aria-hidden="true"></div>
            <div>
              <p class="rotate__text">画面を よこ向きに してね</p>
              <p class="rotate__sub">
                五線譜と鍵盤が よこ長の画面いっぱいに出ます
              </p>
            </div>
          </div>
          <p class="rotate__foot">えんそう中なら、そのまま まっています</p>
        </div>
      );
    }

    return () => (
      <div class="game">
        {phase === "select"
          ? selectScreen()
          : phase === "play"
          ? playScreen()
          : resultScreen()}
        {rotateScreen()}
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

/** The song after this one, wrapping round at the end of the list. */
function nextSong(current: Song): Song {
  const index = SONGS.findIndex((song) => song.id === current.id);
  return SONGS[(index + 1) % SONGS.length];
}

/** One line on what the run was, so the four counts read as detail. */
function verdict(result: Result): string {
  if (result.usedAuto) {
    return "おてほんで さいせいしました。じぶんで弾くと記録がのこります。";
  }
  if (result.miss === 0 && result.good === 0) return "全部バッチリ。文句なし。";
  if (result.miss === 0) {
    return `ミスなし。全部バッチリまで、あと ${result.good}つ。`;
  }
  return `ひろえなかったのが ${result.miss}つ。あと すこし。`;
}

function stars(difficulty: number): string {
  return "★".repeat(difficulty) + "☆".repeat(3 - difficulty);
}

function percent(fraction: number): string {
  return `${(fraction * 100).toFixed(4)}%`;
}
