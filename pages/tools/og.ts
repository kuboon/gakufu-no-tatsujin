/**
 * Builds the sharing image, from the same model the game draws itself with.
 *
 * The card has to keep saying what the game looks like, and the thing that
 * decides that — which hue a pitch gets, where it sits on the staff, how wide
 * a key is — lives in `islands/`. Reading it from there means a change to the
 * palette cannot leave the card behind quietly.
 *
 * Two steps, because turning HTML into a PNG needs a browser and this
 * repository does not otherwise have one:
 *
 * ```sh
 * deno run --allow-read tools/og.ts > og.html
 * # then open og.html at exactly 1200x630 and save the screenshot as
 * # static/og.png — any headless browser will do.
 * ```
 *
 * @module
 */

import { CLEFS } from "../islands/clefs.ts";
import { keyColor, noteColor, solfa, staffStep } from "../islands/music.ts";
import { keyboardLayout, keyRange } from "../islands/keyboard.ts";

const W = 1200, H = 630;
const STAFF_TOP = 178, STAFF_H = 236; // the band the staff lives in
const KEYS_TOP = 430;

const clef = CLEFS.treble;
const space = 30; // one staff space, in pixels
const bottomStep = staffStep(clef.bottom);
const middle = STAFF_TOP + STAFF_H / 2; // the middle line
// A step is half a space, and step 4 above the bottom line is the middle line.
const stepY = (step: number) => middle - (step - bottomStep - 4) * (space / 2);

/** The phrase on the staff: ド レ ミ ソ ラ ソ ミ ド, so every hue shows. */
const PHRASE: [midi: number, beats: number][] = [
  [60, 1],
  [62, 1],
  [64, 2],
  [67, 1],
  [69, 1],
  [67, 2],
  [64, 1],
  [60, 4],
];

let svg = "";
for (let line = 0; line < 5; line += 1) {
  const y = stepY(bottomStep + line * 2);
  svg +=
    `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="rgba(250,238,222,0.42)" stroke-width="1.4"/>`;
}

// The clef sits with its origin on the line it names.
const scale = space / clef.unitsPerSpace;
svg += `<g transform="translate(56,${stepY(staffStep(clef.anchor))}) scale(${
  scale.toFixed(5)
},${
  (-scale).toFixed(5)
})"><path d="${clef.path}" fill="rgba(253,242,228,0.9)"/></g>`;

let x = 210;
for (const [midi, beats] of PHRASE) {
  const y = stepY(staffStep(midi));
  const color = noteColor(midi);
  const filled = beats < 2;
  const rx = space * 0.72, ry = space * 0.52;
  if (staffStep(midi) < bottomStep) {
    svg += `<line x1="${x - rx * 1.5}" y1="${y}" x2="${
      x + rx * 1.5
    }" y2="${y}" stroke="rgba(250,238,222,0.42)" stroke-width="1.8"/>`;
  }
  svg +=
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(-18 ${x} ${y})" fill="${
      filled ? color : "#1a120d"
    }" stroke="${color}" stroke-width="3.4"/>`;
  if (beats < 4) {
    svg += `<line x1="${x + rx * 0.86}" y1="${y - ry * 0.4}" x2="${
      x + rx * 0.86
    }" y2="${
      y - space * 3.4
    }" stroke="${color}" stroke-width="2.8" stroke-linecap="round"/>`;
  }
  svg += `<text x="${x}" y="${
    y + 1
  }" text-anchor="middle" dominant-baseline="middle" font-family="system-ui, sans-serif" font-size="${
    (space * 0.62).toFixed(1)
  }" font-weight="700" fill="${filled ? "rgba(26,18,13,0.86)" : color}">${
    solfa(midi)
  }</text>`;
  x += 88 + beats * 26;
}

// The keyboard, laid out by the game's own geometry.
const { from, to } = keyRange(60, 69);
const keys = keyboardLayout(from, to);
let bed = "";
for (
  const key of keys.filter((k) => !k.black).concat(keys.filter((k) => k.black))
) {
  const left = key.left * W, width = key.width * W;
  const height = key.black ? (H - KEYS_TOP) * 0.52 : H - KEYS_TOP;
  bed +=
    `<div style="position:absolute;top:0;left:${left}px;width:${width}px;height:${height}px;border-radius:0 0 12px 12px;background:${
      keyColor(key.midi)
    };box-shadow:${
      key.black
        ? "inset 0 -10px 16px rgba(0,0,0,0.45), 0 4px 8px rgba(0,0,0,0.6)"
        : "inset 0 -12px 20px rgba(0,0,0,0.18), 0 0 0 1px rgba(5,7,15,0.6)"
    };z-index:${
      key.black ? 2 : 1
    }"><span style="position:absolute;left:0;right:0;bottom:14px;text-align:center;font-size:${
      key.black ? 15 : 19
    }px;font-weight:700;color:${
      key.black ? "rgba(255,255,255,0.75)" : "rgba(26,18,13,0.62)"
    }">${solfa(key.midi)}</span></div>`;
}

const hues = [60, 62, 64, 65, 67, 69, 71]
  .map((m) =>
    `<span style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:${
      noteColor(m)
    };color:rgba(26,18,13,0.78);font-size:14px;font-weight:700">${
      solfa(m)
    }</span>`
  ).join("");

console.log(`<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0}
  body{width:${W}px;height:${H}px;overflow:hidden;
    font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;
    background:linear-gradient(180deg,#2b1d15,#1a120d);color:#fdf2e4}
</style>
<div style="position:relative;width:${W}px;height:${H}px">
  <svg width="${W}" height="${KEYS_TOP}" style="position:absolute;top:0;left:0">${svg}</svg>
  <div style="position:absolute;top:52px;left:56px;right:56px;display:flex;align-items:flex-end;justify-content:space-between;gap:32px">
    <div>
      <div style="font-size:62px;font-weight:800;letter-spacing:0.1em;line-height:1.1">楽譜の達人</div>
      <div style="margin-top:14px;font-size:23px;line-height:1.45;color:rgba(253,242,228,0.72)">音の高さは色。流れてくる音符と同じ色の鍵をおす。</div>
    </div>
    <div style="display:flex;gap:7px;padding-bottom:8px">${hues}</div>
  </div>
  <div style="position:absolute;top:${KEYS_TOP}px;left:0;width:${W}px;height:${
  H - KEYS_TOP
}px;background:#0f0a07;border-top:3px solid rgba(253,242,228,0.25)">${bed}</div>
</div>`);
