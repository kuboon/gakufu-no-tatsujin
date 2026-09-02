/**
 * The staff: five lines with the melody scrolling across them, right to left.
 *
 * The rhythm is drawn twice over, deliberately. *When* a note reaches the judgement line is the
 * rhythm you play; the head, stem and flags are the same rhythm written down, so the bar you are
 * about to play can be read a bar ahead instead of only felt.
 */

import { type Clef, type ClefName, CLEFS } from "./clefs.ts";
import {
  isSharpened,
  noteColor,
  noteShape,
  solfa,
  staffStep,
} from "./music.ts";

/** Where a note is in its life: waiting to be played, judged, or gone by. */
export type NoteState = "pending" | "perfect" | "good" | "miss";

/** A note as the staff needs to draw it. */
export interface NoteView {
  midi: number;
  beat: number;
  beats: number;
  state: NoteState;
  /** When it was judged, on the game clock — the pop and fade run from here. */
  judgedAt: number;
}

/** Everything one frame of the staff is drawn from. */
export interface StageView {
  /** Seconds on the game clock. */
  now: number;
  /** The playhead, in beats. Negative during the count-in. */
  beat: number;
  beatsPerBar: number;
  bars: number;
  /** How many beats of music are visible to the right of the judgement line. */
  lookahead: number;
  notes: readonly NoteView[];
  /** Which clef the staff is written in. */
  clef: ClefName;
  score: number;
  combo: number;
  /** The bar being played, counting from 1. */
  bar: number;
  /** How far through the song, 0 to 1. */
  progress: number;
  flash: { state: NoteState; at: number } | null;
}

const BACKGROUND_TOP = "#2b1d15";
const BACKGROUND_BOTTOM = "#1a120d";
const STAFF_LINE = "rgba(250,238,222,0.42)";
const BAR_LINE = "rgba(250,238,222,0.3)";
const TEXT = "#fdf2e4";
const MUTED = "rgba(253,242,228,0.55)";
const ACCENT = "#ffc247";
/** The band the readouts sit in, so notes never slide behind them. */
const HUD_HEIGHT = 34;

const FLASH_SECONDS = 0.5;
const POP_SECONDS = 0.32;

const LABELS: Record<NoteState, string> = {
  pending: "",
  perfect: "バッチリ！",
  good: "ナイス",
  miss: "ミス",
};

const FLASH_COLORS: Record<NoteState, string> = {
  pending: TEXT,
  perfect: ACCENT,
  good: "#b7d94a",
  miss: "#e0714a",
};

/** Where everything sits, once the canvas size is known. */
interface Metrics {
  width: number;
  height: number;
  /** One staff space, in pixels. Every other size is a multiple of it. */
  space: number;
  /** Vertical centre of the staff, the middle line. */
  middle: number;
  /** The judgement line. */
  hitX: number;
  clefRight: number;
  pixelsPerBeat: number;
  /** The clef in force, and the two steps every other position is measured from. */
  clef: Clef;
  bottomStep: number;
  middleStep: number;
}

/** The scrolling staff, drawn on a canvas. */
export class Stage {
  #canvas: HTMLCanvasElement;
  #context: CanvasRenderingContext2D | null;
  #width = 0;
  #height = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
    this.#context = canvas.getContext("2d");
  }

  /** Matches the drawing buffer to the element's size and the display's pixel density. */
  fit(): void {
    const ratio = Math.min(globalThis.devicePixelRatio ?? 1, 3);
    const width = this.#canvas.clientWidth;
    const height = this.#canvas.clientHeight;
    if (width === 0 || height === 0) return;

    this.#width = width;
    this.#height = height;
    this.#canvas.width = Math.round(width * ratio);
    this.#canvas.height = Math.round(height * ratio);
    this.#context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  /** Draws one frame. */
  draw(view: StageView): void {
    const context = this.#context;
    if (context === null) return;
    if (this.#canvas.clientWidth !== this.#width) this.fit();
    if (this.#width === 0 || this.#height === 0) return;

    const metrics = this.#metrics(view);
    drawBackground(context, metrics);
    drawStaffLines(context, metrics);
    drawBarLines(context, metrics, view);
    drawCountIn(context, metrics, view);
    for (const note of view.notes) drawNote(context, metrics, view, note);
    drawClef(context, metrics);
    drawHitLine(context, metrics);
    drawHud(context, metrics, view);
  }

  #metrics(view: StageView): Metrics {
    const width = this.#width;
    const height = this.#height;
    const space = Math.min((height - HUD_HEIGHT) / 8.5, 34);
    const hitX = Math.max(78, width * 0.22);
    const clef = CLEFS[view.clef];
    return {
      width,
      height,
      space,
      middle: HUD_HEIGHT + (height - HUD_HEIGHT) * 0.52,
      hitX,
      clefRight: 16 + space * 2.6,
      pixelsPerBeat: (width - hitX) / view.lookahead,
      clef,
      bottomStep: staffStep(clef.bottom),
      middleStep: staffStep(clef.bottom) + 4,
    };
  }
}

/** Vertical position of a diatonic step. */
function stepY(metrics: Metrics, step: number): number {
  return metrics.middle - (step - metrics.middleStep) * metrics.space / 2;
}

/** Horizontal position of a moment in the music. */
function beatX(metrics: Metrics, view: StageView, beat: number): number {
  return metrics.hitX + (beat - view.beat) * metrics.pixelsPerBeat;
}

function drawBackground(context: CanvasRenderingContext2D, metrics: Metrics) {
  const gradient = context.createLinearGradient(0, 0, 0, metrics.height);
  gradient.addColorStop(0, BACKGROUND_TOP);
  gradient.addColorStop(1, BACKGROUND_BOTTOM);
  context.fillStyle = gradient;
  context.fillRect(0, 0, metrics.width, metrics.height);

  // The stretch already played, so the judgement line reads as the edge of "now".
  context.fillStyle = "rgba(0,0,0,0.28)";
  context.fillRect(0, 0, metrics.hitX, metrics.height);
}

function drawStaffLines(context: CanvasRenderingContext2D, metrics: Metrics) {
  context.strokeStyle = STAFF_LINE;
  context.lineWidth = 1;
  context.beginPath();
  for (let line = 0; line < 5; line++) {
    const y = Math.round(stepY(metrics, metrics.bottomStep + line * 2)) + 0.5;
    context.moveTo(0, y);
    context.lineTo(metrics.width, y);
  }
  context.stroke();
}

function drawBarLines(
  context: CanvasRenderingContext2D,
  metrics: Metrics,
  view: StageView,
) {
  const top = stepY(metrics, metrics.bottomStep + 8);
  const bottom = stepY(metrics, metrics.bottomStep);

  for (let bar = 0; bar <= view.bars; bar++) {
    const x = beatX(metrics, view, bar * view.beatsPerBar);
    if (x < -8 || x > metrics.width + 8) continue;

    const last = bar === view.bars;
    context.strokeStyle = last ? TEXT : BAR_LINE;
    context.lineWidth = last ? 3 : 1.5;
    context.beginPath();
    context.moveTo(Math.round(x) + 0.5, top);
    context.lineTo(Math.round(x) + 0.5, bottom);
    context.stroke();

    if (!last && bar < view.bars) {
      context.fillStyle = MUTED;
      context.font = `${
        Math.round(metrics.space * 0.62)
      }px system-ui, sans-serif`;
      context.textAlign = "left";
      context.textBaseline = "alphabetic";
      context.fillText(String(bar + 1), x + 4, top - metrics.space * 0.5);
    }
  }
}

/** Outlines are parsed once; a `Path2D` is cheap to reuse and costly to rebuild each frame. */
const CLEF_PATHS = new Map<string, Path2D>();

function clefPath(clef: Clef): Path2D {
  let path = CLEF_PATHS.get(clef.path);
  if (path === undefined) {
    path = new Path2D(clef.path);
    CLEF_PATHS.set(clef.path, path);
  }
  return path;
}

/**
 * The clef, drawn from its outline.
 *
 * SMuFL puts the origin on the line the clef names, so translating to that line and scaling by the
 * staff space is the whole placement — there is no per-clef offset to get wrong.
 */
function drawClef(context: CanvasRenderingContext2D, metrics: Metrics) {
  const { clef, space } = metrics;
  const scale = space / clef.unitsPerSpace;

  context.save();
  context.translate(16, stepY(metrics, staffStep(clef.anchor)));
  context.scale(scale, -scale);
  context.fillStyle = "rgba(253,242,228,0.85)";
  context.fill(clefPath(clef));
  context.restore();
}

function drawNote(
  context: CanvasRenderingContext2D,
  metrics: Metrics,
  view: StageView,
  note: NoteView,
) {
  const x = beatX(metrics, view, note.beat);
  const unit = metrics.space;
  if (x < metrics.clefRight - unit || x > metrics.width + unit * 3) return;

  const step = staffStep(note.midi);
  const y = stepY(metrics, step);
  const shape = noteShape(note.beats);

  // Fades out as it slides past the judgement line and into the clef.
  const runway = metrics.hitX - metrics.clefRight;
  let alpha = runway > 0
    ? Math.min(1, Math.max(0, (x - metrics.clefRight) / runway))
    : 1;
  let scale = 1;

  if (note.state === "miss") {
    alpha *= 0.4;
  } else if (note.state !== "pending") {
    const age = (view.now - note.judgedAt) / POP_SECONDS;
    if (age >= 1) return;
    alpha *= 1 - age;
    scale = 1 + age * 0.9;
  }

  const color = note.state === "miss"
    ? "rgba(200,205,225,0.9)"
    : noteColor(note.midi);
  const headX = unit * 0.66;
  const headY = unit * 0.48;

  context.save();
  context.globalAlpha = alpha;
  context.translate(x, y);
  context.scale(scale, scale);

  drawLedgerLines(context, metrics, step, headX);

  if (isSharpened(note.midi)) drawSharp(context, unit, -headX - unit * 0.5);

  context.lineWidth = unit * 0.16;
  context.strokeStyle = color;
  context.fillStyle = color;

  context.beginPath();
  context.ellipse(0, 0, headX, headY, -0.32, 0, Math.PI * 2);
  if (shape.filled) context.fill();
  else context.stroke();

  if (shape.stem) {
    const up = step <= metrics.middleStep;
    const stemX = up ? headX * 0.88 : -headX * 0.88;
    const stemEnd = up ? -unit * 3.2 : unit * 3.2;
    context.lineWidth = Math.max(1.4, unit * 0.12);
    context.beginPath();
    context.moveTo(stemX, up ? -headY * 0.35 : headY * 0.35);
    context.lineTo(stemX, stemEnd);
    context.stroke();

    for (let flag = 0; flag < shape.flags; flag++) {
      const from = stemEnd + (up ? flag * unit * 0.62 : -flag * unit * 0.62);
      context.beginPath();
      context.moveTo(stemX, from);
      context.bezierCurveTo(
        stemX + unit * 0.9,
        from + (up ? unit * 0.5 : -unit * 0.5),
        stemX + unit * 0.95,
        from + (up ? unit * 1.0 : -unit * 1.0),
        stemX + unit * 0.3,
        from + (up ? unit * 1.5 : -unit * 1.5),
      );
      context.stroke();
    }
  }

  if (shape.dotted) {
    const onLine = (step - metrics.bottomStep) % 2 === 0;
    context.beginPath();
    context.arc(
      headX + unit * 0.55,
      onLine ? -unit * 0.5 : 0,
      unit * 0.15,
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  if (unit >= 12) {
    const label = solfa(note.midi);
    context.fillStyle = shape.filled ? "rgba(12,16,34,0.92)" : color;
    context.font = `600 ${
      Math.round(unit * (label.length === 1 ? 0.74 : 0.48))
    }px system-ui, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, 0, unit * 0.02);
  }

  context.restore();
}

function drawLedgerLines(
  context: CanvasRenderingContext2D,
  metrics: Metrics,
  step: number,
  headX: number,
) {
  const top = metrics.bottomStep + 8;
  const width = headX * 1.7;
  context.strokeStyle = STAFF_LINE;
  context.lineWidth = 1.4;
  context.beginPath();
  for (let s = top + 2; s <= step; s += 2) {
    const y = stepY(metrics, s) - stepY(metrics, step);
    context.moveTo(-width, y);
    context.lineTo(width, y);
  }
  for (let s = metrics.bottomStep - 2; s >= step; s -= 2) {
    const y = stepY(metrics, s) - stepY(metrics, step);
    context.moveTo(-width, y);
    context.lineTo(width, y);
  }
  context.stroke();
}

/** A sharp sign, drawn to the left of the head it belongs to. */
function drawSharp(
  context: CanvasRenderingContext2D,
  unit: number,
  x: number,
) {
  context.save();
  context.strokeStyle = TEXT;
  context.lineWidth = Math.max(1.2, unit * 0.1);
  context.beginPath();
  context.moveTo(x - unit * 0.16, -unit * 0.62);
  context.lineTo(x - unit * 0.16, unit * 0.5);
  context.moveTo(x + unit * 0.16, -unit * 0.7);
  context.lineTo(x + unit * 0.16, unit * 0.42);
  context.moveTo(x - unit * 0.34, -unit * 0.1);
  context.lineTo(x + unit * 0.34, -unit * 0.26);
  context.moveTo(x - unit * 0.34, unit * 0.3);
  context.lineTo(x + unit * 0.34, unit * 0.14);
  context.stroke();
  context.restore();
}

function drawHitLine(context: CanvasRenderingContext2D, metrics: Metrics) {
  const x = Math.round(metrics.hitX) + 0.5;
  context.save();
  context.strokeStyle = "rgba(255,255,255,0.92)";
  context.lineWidth = 2;
  context.shadowColor = "rgba(150,190,255,0.9)";
  context.shadowBlur = 14;
  context.beginPath();
  context.moveTo(x, metrics.space * 0.3);
  context.lineTo(x, metrics.height);
  context.stroke();
  context.restore();

  context.fillStyle = "rgba(255,255,255,0.92)";
  context.beginPath();
  context.moveTo(x - metrics.space * 0.45, metrics.height);
  context.lineTo(x + metrics.space * 0.45, metrics.height);
  context.lineTo(x, metrics.height - metrics.space * 0.5);
  context.closePath();
  context.fill();
}

function drawHud(
  context: CanvasRenderingContext2D,
  metrics: Metrics,
  view: StageView,
) {
  // A band, so a note streaming in never passes behind the buttons above it.
  const band = context.createLinearGradient(0, 0, 0, HUD_HEIGHT);
  band.addColorStop(0, "rgba(26,18,13,0.92)");
  band.addColorStop(1, "rgba(26,18,13,0)");
  context.fillStyle = band;
  context.fillRect(0, 0, metrics.width, HUD_HEIGHT);

  context.fillStyle = "rgba(253,242,228,0.1)";
  context.fillRect(0, 0, metrics.width, 3);
  context.fillStyle = ACCENT;
  context.fillRect(
    0,
    0,
    metrics.width * Math.min(1, Math.max(0, view.progress)),
    3,
  );

  const size = Math.max(12, Math.min(17, metrics.height * 0.075));

  context.textBaseline = "middle";
  context.textAlign = "left";
  context.fillStyle = TEXT;
  context.font = `700 ${Math.round(size)}px system-ui, sans-serif`;
  const score = `${view.score}`;
  context.fillText(score, 12, HUD_HEIGHT / 2 + 2);
  // Measured in the face it was drawn in, before the font changes underneath it.
  const after = 12 + context.measureText(score).width + 6;

  context.font = `500 ${Math.round(size * 0.62)}px system-ui, sans-serif`;
  context.fillStyle = MUTED;
  context.fillText("てん", after, HUD_HEIGHT / 2 + 3);
  context.fillText(
    `${view.bar} / ${view.bars}小節`,
    after + 28,
    HUD_HEIGHT / 2 + 3,
  );

  if (view.combo >= 2) {
    context.textAlign = "center";
    context.fillStyle = ACCENT;
    context.font = `700 ${Math.round(size)}px system-ui, sans-serif`;
    context.fillText(
      `${view.combo} コンボ`,
      metrics.width / 2,
      HUD_HEIGHT / 2 + 2,
    );
  }

  if (view.flash !== null) {
    const age = (view.now - view.flash.at) / FLASH_SECONDS;
    if (age < 1) {
      context.save();
      context.globalAlpha = 1 - age * age;
      context.textAlign = "center";
      context.textBaseline = "bottom";
      context.fillStyle = FLASH_COLORS[view.flash.state];
      context.font = `800 ${
        Math.round(metrics.space * 1.1)
      }px system-ui, sans-serif`;
      context.fillText(
        LABELS[view.flash.state],
        metrics.hitX,
        stepY(metrics, metrics.bottomStep + 8) - metrics.space * (1.2 + age),
      );
      context.restore();
    }
  }
}

/** The count-in, ticking down behind the staff before the first note arrives. */
function drawCountIn(
  context: CanvasRenderingContext2D,
  metrics: Metrics,
  view: StageView,
) {
  if (view.beat >= 0 || view.beat < -view.beatsPerBar) return;
  const remaining = Math.ceil(-view.beat);
  const fraction = 1 - (-view.beat - Math.floor(-view.beat));

  context.save();
  context.globalAlpha = 0.12 + 0.3 * (1 - fraction);
  context.fillStyle = TEXT;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `800 ${Math.round(metrics.space * 3)}px system-ui, sans-serif`;
  context.fillText(
    String(remaining),
    metrics.width * 0.62,
    metrics.middle,
  );
  context.restore();
}
