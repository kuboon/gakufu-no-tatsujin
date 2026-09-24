/**
 * The rests, as outlines.
 *
 * The same reasoning as the clefs next door: the characters exist, and the system fonts on the
 * phones this game is played on do not carry them, so a rest written as text is a blank box exactly
 * where the player needs to read silence. An outline always draws.
 *
 * The five paths below are Bravura's `restWhole` (U+E4E3) through `rest16th` (U+E4E7), taken as
 * path data. SMuFL fixes the staff space at 250 units and puts each glyph's origin on the staff
 * line it hangs from or sits on, so placement is a translate to that line and a scale — the same
 * two steps a clef takes.
 *
 * ---
 * Bravura © 2026 Steinberg Media Technologies GmbH (https://www.steinberg.net/), with Reserved Font
 * Name "Bravura". Licensed under the SIL Open Font License, Version 1.1
 * (https://scripts.sil.org/OFL). The full licence text is in LICENSES/OFL-1.1-Bravura.txt.
 */

/** The note value a rest is written with. */
export type RestName = "whole" | "half" | "quarter" | "eighth" | "sixteenth";

/** How a rest is drawn. */
export interface RestGlyph {
  /** Outline in font units, y up, origin on the staff line below. */
  path: string;
  /** Staff space in those units. SMuFL fixes this at a quarter of the em. */
  unitsPerSpace: number;
  /**
   * Diatonic steps above the bottom line for the glyph's origin.
   *
   * 4 is the middle line, which is where every rest but the whole one is centred on or sits above;
   * the whole rest hangs under the line above it, at 6.
   */
  line: number;
  /** How wide the glyph draws, in the same units. A dot goes to the right of this. */
  width: number;
}

export const REST_GLYPHS: Record<RestName, RestGlyph> = {
  whole: {
    path:
      "M282 -109V-17C282 -2 270 9 256 9H26C11 9 0 -2 0 -17V-109C0 -123 11 -135 26 -135H256C270 -135 282 -123 282 -109Z",
    unitsPerSpace: 250,
    line: 6,
    width: 282,
  },
  half: {
    path:
      "M282 24V116C282 131 270 142 256 142H26C11 142 0 131 0 116V24C0 10 11 -2 26 -2H256C270 -2 282 10 282 24Z",
    unitsPerSpace: 250,
    line: 4,
    width: 282,
  },
  quarter: {
    path:
      "M78 -38C94 -58 108 -77 121 -98C123 -102 127 -110 127 -112C127 -113 127 -115 126 -116C124 -120 120 -121 115 -121C111 -121 103 -119 99 -118C94 -118 88 -115 83 -115C40 -115 1 -158 1 -211C1 -261 44 -310 117 -366C125 -372 135 -375 143 -375C150 -375 157 -373 158 -369C159 -366 160 -364 160 -362C160 -353 152 -345 144 -338C131 -338 120 -311 118 -302C115 -294 114 -285 114 -276C114 -245 129 -210 161 -204C166 -203 171 -203 177 -203C206 -203 239 -214 255 -220C256 -220 257 -221 258 -221C261 -222 263 -222 265 -222C268 -222 270 -221 270 -218C270 -206 244 -173 233 -161C195 -115 164 -78 164 -22C164 -18 165 -13 165 -9C169 49 205 97 231 138C234 143 235 148 235 153C235 163 231 172 231 172C231 172 83 348 66 365C61 370 54 373 48 373C38 373 28 366 28 352C28 347 29 342 32 336C36 325 93 274 93 202C93 165 78 122 33 75C23 65 19 54 19 46C19 32 29 22 29 22Z",
    unitsPerSpace: 250,
    line: 4,
    width: 270,
  },
  eighth: {
    path:
      "M134 107C134 144 104 174 67 174C30 174 0 144 0 107C0 86 12 68 27 56C36 50 45 45 55 43C63 41 72 39 81 39C95 39 109 42 120 46C134 50 143 54 156 61C158 62 160 62 161 62C165 62 166 58 166 53C166 50 166 46 165 42C162 27 90 -172 72 -238C72 -250 95 -251 101 -251C112 -251 126 -249 136 -241C139 -239 237 112 237 112C241 130 246 146 247 151C247 161 237 166 235 167C233 167 230 167 224 163C217 157 167 97 134 97Z",
    unitsPerSpace: 250,
    line: 4,
    width: 247,
  },
  sixteenth: {
    path:
      "M208 111C208 149 178 179 140 179C103 179 72 149 72 111C72 91 84 72 100 60C108 54 118 49 128 46C135 44 143 43 152 43C166 43 182 46 194 50C208 54 217 58 230 65C233 66 235 67 237 67C240 67 242 65 242 60C242 57 241 52 239 45C237 37 193 -101 184 -120C176 -139 149 -151 135 -151C136 -147 136 -144 136 -141C136 -103 105 -73 68 -73C30 -73 0 -103 0 -141C0 -161 12 -180 28 -192C36 -198 45 -203 55 -206C63 -208 71 -209 80 -209C94 -209 110 -206 122 -202C136 -198 142 -195 155 -188C157 -188 159 -190 159 -193C159 -194 158 -195 158 -196L63 -479C63 -480 62 -481 62 -482C62 -490 71 -500 93 -500C122 -500 127 -488 131 -477L247 -96C273 -11 292 56 292 56C292 56 317 144 319 157C319 159 320 160 320 161C320 167 312 171 310 172C305 172 302 170 299 168C292 162 242 102 208 101Z",
    unitsPerSpace: 250,
    line: 4,
    width: 320,
  },
};
