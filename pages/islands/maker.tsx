/**
 * The editor: write a melody, get a link that plays it.
 *
 * Everything here is a view of one {@link CustomSpec}, read back out of the fields as they are
 * typed. The melody is parsed on every keystroke, because the useful thing an editor can do with
 * this notation is say immediately whether it reads — a bar that does not add up is a typo, and a
 * typo is worth catching in the line you are writing rather than in the link you just sent.
 *
 * The fields are uncontrolled on purpose. `@remix-run/ui` reflects a `value` prop back onto the
 * DOM in a microtask, which fights a field someone is typing into; the framework's own answer is
 * `defaultValue` and reading what was typed off the event, which is what this does.
 */

import { on, ref } from "@remix-run/ui";
import type { Handle, RemixNode } from "@remix-run/ui";
import { island } from "@kuboon/remix-ssg/client";

import type { ClefName } from "./clefs.ts";
import {
  BLANK,
  buildCustom,
  type CustomResult,
  type CustomSpec,
  readSearch,
  searchFor,
} from "./custom.ts";
import { WHITE_KEYS, whiteKeysNeeded } from "./keyboard.ts";
import { noteColor, pitchLabel, solfa } from "./music.ts";
import type { Song } from "./songs.ts";

/** What the 「例を入れる」 button writes: かえるのうた, which everyone can check by ear. */
const EXAMPLE = "t120 l4 o4 | c d e f | e d c r | e f g a | g f e r";

/** The notation, in one table — the whole of it, since there is not much. */
const NOTATION: readonly (readonly [string, string])[] = [
  ["c d e f g a b", "ドレミファソラシ。r は休符"],
  ["+ # -", "直前の音を半音上げる・下げる"],
  ["数字", "長さ。c8 は八分音符、c2 は二分音符"],
  [".", "付点。c4. は1.5拍"],
  ["t", "テンポ。t120 で ♩=120"],
  ["l", "長さの既定値。l8 のあとは c が八分音符"],
  ["o > <", "オクターブ。o4c が中央ハ"],
  ["[ ]n", "くり返し。回数を省くと2回"],
  ["&", "タイ。同じ高さの音をつなぐ"],
  [",", "パートの区切り。和音はこれで書く"],
  ["|", "小節線"],
];

export const Maker = island(
  "maker",
  "Maker",
  function Maker(handle: Handle<{ base: string }>) {
    let spec: CustomSpec = BLANK;
    let result: CustomResult = buildCustom(BLANK);
    let copied = false;

    // The live fields. Held so the URL this page was opened with can be poured
    // into them once, and so the example button has something to write to.
    let mmlNode: HTMLTextAreaElement | null = null;
    let titleNode: HTMLInputElement | null = null;
    let beatsNode: HTMLInputElement | null = null;
    let clefNode: HTMLSelectElement | null = null;
    let linkNode: HTMLInputElement | null = null;
    let seeded = false;

    /**
     * Fills the form from the URL, once every field is on the page.
     *
     * Called from each field's own hook rather than from one place, so it does
     * not depend on which order the hooks happen to run in: whichever field is
     * last to arrive is the one that finds them all present.
     *
     * The seed has to wait for the browser either way. The page is built ahead
     * of time and has no query string then, so filling the fields during the
     * first render would disagree with the HTML every visitor is served.
     */
    function seed(): void {
      if (seeded) return;
      if (
        mmlNode === null || titleNode === null || beatsNode === null ||
        clefNode === null
      ) return;
      seeded = true;

      const carried = readSearch(globalThis.location?.search ?? "");
      if (carried === null) return;

      spec = carried;
      mmlNode.value = carried.mml;
      titleNode.value = carried.title;
      beatsNode.value = String(carried.beatsPerBar);
      clefNode.value = carried.clef;
      result = buildCustom(spec);
      void handle.update();
    }

    function change(patch: Partial<CustomSpec>): void {
      spec = { ...spec, ...patch };
      result = buildCustom(spec);
      copied = false;
      void handle.update();
    }

    function useExample(): void {
      if (mmlNode === null) return;
      mmlNode.value = EXAMPLE;
      change({ mml: EXAMPLE });
    }

    /**
     * The link that plays it.
     *
     * Absolute, and built from the deploy prefix the page hands down rather than from where this
     * page happens to sit: the game is served at the prefix itself, which carries a trailing slash
     * on the published site and none on a PR preview, so a relative path would land in a different
     * place depending on which one someone opened.
     */
    function link(): string {
      const here = globalThis.location?.href;
      if (here === undefined) return "";
      return new URL(`${handle.props.base}/${searchFor(spec)}`, here).href;
    }

    async function copy(): Promise<void> {
      try {
        await navigator.clipboard.writeText(link());
        copied = true;
      } catch {
        // Some browsers only hand over the clipboard on https, and some not at
        // all. Selecting the text is the next best thing: one keystroke away.
        linkNode?.select();
        copied = false;
      }
      void handle.update();
    }

    function verdict(): RemixNode {
      if (!("song" in result)) {
        return (
          <p class="maker__error">
            <span class="maker__error-mark" aria-hidden="true">!</span>
            {result.error}
          </p>
        );
      }
      return reading(result.song);
    }

    /** What the melody turned out to be, once it reads. */
    function reading(made: Song): RemixNode {
      const seconds = made.bars * made.beatsPerBar * 60 / made.bpm;
      const pitches = [...new Set(made.notes.map((note) => note.midi))].sort(
        (a, b) => a - b,
      );

      return (
        <div class="maker__reading">
          <ul class="maker__facts">
            <li>
              <span>小節</span>
              <strong>{made.bars}</strong>
            </li>
            <li>
              <span>音符</span>
              <strong>{made.notes.length}</strong>
            </li>
            <li>
              <span>速さ</span>
              <strong>♩={made.bpm}</strong>
            </li>
            <li>
              <span>長さ</span>
              <strong>{seconds.toFixed(1)}秒</strong>
            </li>
          </ul>
          <p class="maker__range">
            {pitchLabel(made.lowest)}から{pitchLabel(made.highest)}まで、白鍵
            {" "}
            {whiteKeysNeeded(made.lowest, made.highest)}つぶん。 鍵盤は白鍵{" "}
            {WHITE_KEYS} つなので、これより広い曲は弾けません。
          </p>
          <span class="maker__colors">
            {pitches.map((midi) => (
              <span
                key={midi}
                class="dot"
                style={`background:${noteColor(midi)}`}
                title={solfa(midi)}
              >
              </span>
            ))}
          </span>
        </div>
      );
    }

    /** The link itself, once there is one to give. */
    function share(): RemixNode {
      if (!("song" in result)) return null;
      const url = link();

      return (
        <div class="maker__share">
          <label class="field">
            <span class="field__label">できたリンク</span>
            <input
              type="text"
              class="field__input maker__link"
              readonly
              value={url}
              mix={[
                ref((node) => {
                  linkNode = node as HTMLInputElement;
                }),
                on("focus", () => linkNode?.select()),
              ]}
            />
          </label>
          <div class="maker__actions">
            <button
              type="button"
              class="primary"
              mix={[on("click", () => void copy())]}
            >
              {copied ? "コピーしました" : "リンクをコピー"}
            </button>
            <a class="toggle" href={url} {...DOCUMENT_LINK}>
              ひらいて弾く
            </a>
          </div>
        </div>
      );
    }

    return () => (
      <div class="maker">
        <div class="maker__form">
          <div class="field">
            <span class="field__label">
              楽譜
              <button
                type="button"
                class="field__aside"
                mix={[on("click", useExample)]}
              >
                例を入れる
              </button>
            </span>
            <textarea
              class="field__input maker__mml"
              aria-label="楽譜"
              rows={5}
              spellcheck={false}
              placeholder="t120 l4 o4 | c d e f | g2 g2"
              mix={[
                ref((node) => {
                  mmlNode = node as HTMLTextAreaElement;
                  seed();
                }),
                on("input", (event) =>
                  change({
                    mml: (event.currentTarget as HTMLTextAreaElement).value,
                  })),
              ]}
            >
            </textarea>
          </div>

          <div class="maker__row">
            <label class="field">
              <span class="field__label">曲名</span>
              <input
                type="text"
                class="field__input"
                placeholder="じぶんの曲"
                maxlength={40}
                mix={[
                  ref((node) => {
                    titleNode = node as HTMLInputElement;
                    seed();
                  }),
                  on("input", (event) =>
                    change({
                      title: (event.currentTarget as HTMLInputElement).value,
                    })),
                ]}
              />
            </label>
            <label class="field field--narrow">
              <span class="field__label">1小節の拍数</span>
              <input
                type="number"
                class="field__input"
                min="1"
                max="16"
                defaultValue="4"
                mix={[
                  ref((node) => {
                    beatsNode = node as HTMLInputElement;
                    seed();
                  }),
                  on("input", (event) =>
                    change({
                      beatsPerBar: Number(
                        (event.currentTarget as HTMLInputElement).value,
                      ),
                    })),
                ]}
              />
            </label>
            <label class="field field--narrow">
              <span class="field__label">音部記号</span>
              <select
                class="field__input"
                mix={[
                  ref((node) => {
                    clefNode = node as HTMLSelectElement;
                    seed();
                  }),
                  on("change", (event) =>
                    change({
                      clef: (event.currentTarget as HTMLSelectElement)
                        .value as ClefName,
                    })),
                ]}
              >
                <option value="treble" selected>ト音記号</option>
                <option value="bass">ヘ音記号</option>
              </select>
            </label>
          </div>

          {verdict()}
          {share()}
        </div>

        <details class="maker__help">
          <summary>書きかた</summary>
          <table class="maker__table">
            <tbody>
              {NOTATION.map(([mark, meaning]) => (
                <tr key={mark}>
                  <th scope="row">
                    <code>{mark}</code>
                  </th>
                  <td>{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            大文字でも小文字でも同じです。書かなければテンポは120、長さは四分音符、
            オクターブは4になります。
          </p>
        </details>
      </div>
    );
  },
);

/** Marks an `<a>` as leaving this page — the site is separate documents, not one app. */
const DOCUMENT_LINK = { "rmx-document": "" } as Record<string, string>;
