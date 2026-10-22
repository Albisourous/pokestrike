// ui.ts — the menu-window chrome kit. Every panel, overlay, card and list
// row in the game draws through these primitives so the whole UI reads as
// one window system (the Gen-3 handheld canon, on our navy/paper/gold).
// Self-contained: nothing imports from screens.ts — it's the root.

// --- palette (was private to screens.ts; now the single source) ----------
export const INK = '#283058';
export const INK_SOFT = '#586070';
export const INK_FAINT = '#989aa8';
export const PAPER = '#f8f8f0';
export const PAPER_HI = '#ffffff';
export const PARCH = '#f0e6c8'; // light text — dark chrome and field only, never on PAPER
export const GOLD = '#c8a44d';
export const GOLD_HI = '#ffd848'; // the CTA face
export const ACCENT = '#2a68c8'; // highlighted secondary text on paper
export const DANGER = '#d04840';

// --- type ---------------------------------------------------------------
// UI font: Press Start 2P — the Gen-3 handheld look — vendored in
// public/fonts; Roboto Condensed and monospace are the failure fallbacks.
const PIXEL_FONT = 'ps2p, rc, monospace';
const FONT_SCALE = 1.4;
export const font = (px: number) => `400 ${Math.round(px * FONT_SCALE)}px ${PIXEL_FONT}`;
// dense small print stays in the narrow face — the pixel font runs ~1.7x wider
export const fontB = (px: number) => `700 ${Math.round(px * FONT_SCALE)}px rc, monospace`;

// --- internals ------------------------------------------------------------
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// bounded measure memo — font+text fully determine width; cold restart on
// full beats eviction bookkeeping (contents are static strings)
const mw = new Map<string, number>();
const meas = (ctx: CanvasRenderingContext2D, text: string) => {
  const k = `${ctx.font}\n${text}`;
  let v = mw.get(k);
  if (v === undefined) {
    if (mw.size >= 500) mw.clear();
    mw.set(k, (v = ctx.measureText(text).width));
  }
  return v;
};

// shrink a pixel-font label until it fits — pixel type runs wide
export function ufit(ctx: CanvasRenderingContext2D, label: string, px: number, maxW: number) {
  let s = px;
  ctx.font = font(s);
  while (s > 6 && meas(ctx, label) > maxW) ctx.font = font(--s);
  return s;
}

// --- the window system -----------------------------------------------------

// dim the world behind an overlay window — INK at `a`, default 62%
export function scrim(ctx: CanvasRenderingContext2D, a = 0.62) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, ctx.canvas.width * 4, ctx.canvas.height * 4);
  ctx.restore();
}

// THE panel: paper face, 3px INK frame, inner hairline rim (the double-frame
// signature of the handheld windows), hard offset shadow. `dark` inverts to
// an INK face (the tab strip, night panels); `tint` swaps the face color;
// `rim:false` drops the inner line for tiny boxes.
export function uiWindow(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  o: { dark?: boolean; tint?: string; rim?: boolean; shadow?: boolean; rad?: number } = {},
) {
  const rad = o.rad ?? 8;
  if (o.shadow !== false) {
    ctx.fillStyle = 'rgba(40,48,88,0.35)';
    rr(ctx, r.x + 2, r.y + 5, r.w, r.h, rad);
    ctx.fill();
  }
  rr(ctx, r.x, r.y, r.w, r.h, rad);
  ctx.fillStyle = o.tint ?? (o.dark ? INK : PAPER);
  ctx.fill();
  ctx.strokeStyle = o.dark ? PARCH : INK;
  ctx.lineWidth = 3;
  rr(ctx, r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, Math.max(2, rad - 1));
  ctx.stroke();
  if (o.rim !== false && r.w > 36 && r.h > 36) {
    ctx.strokeStyle = o.dark ? 'rgba(240,230,200,0.22)' : 'rgba(40,48,88,0.22)';
    ctx.lineWidth = 1.5;
    rr(ctx, r.x + 6, r.y + 6, r.w - 12, r.h - 12, Math.max(1, rad - 5));
    ctx.stroke();
  }
}

// the INK title band across a window's top — PARCH pixel title, 2px GOLD
// baseline. Expects a window already drawn; clips to the window's rounded
// top so only the TOP corners round. Returns the content-top y.
export function uiBand(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  title: string,
  o: { sub?: string; h?: number; rad?: number; dark?: boolean } = {},
) {
  const h = o.h ?? 30;
  const rad = o.rad ?? 8;
  ctx.save();
  rr(ctx, r.x + 3, r.y + 3, r.w - 6, h + rad, Math.max(1, rad - 2));
  ctx.clip();
  ctx.fillStyle = o.dark ? '#1b2140' : INK;
  ctx.fillRect(r.x + 3, r.y + 3, r.w - 6, h);
  ctx.restore();
  ctx.fillStyle = GOLD;
  ctx.fillRect(r.x + 3, r.y + 3 + h, r.w - 6, 2);
  const pa = ctx.textAlign;
  ctx.textAlign = 'center';
  ctx.fillStyle = PARCH;
  ufit(ctx, title, 9, r.w - 40);
  ctx.fillText(title, r.x + r.w / 2, r.y + 3 + h / 2 + 4);
  if (o.sub) {
    ctx.textAlign = 'right';
    ctx.font = fontB(7);
    ctx.fillStyle = '#a8b0d0';
    ctx.fillText(o.sub, r.x + r.w - 12, r.y + 3 + h / 2 + 3);
  }
  ctx.textAlign = pa;
  return r.y + 3 + h + 2;
}

// one-call overlay frame: window + band. Returns the content rect inside
// the rim so callers fill below the title without re-mathing the inset.
export function uiPanel(ctx: CanvasRenderingContext2D, r: Rect, title: string, o: Parameters<typeof uiBand>[3] & Parameters<typeof uiWindow>[2] = {}) {
  uiWindow(ctx, r, o);
  const top = uiBand(ctx, r, title, o);
  return { x: r.x + 10, y: top + 8, w: r.w - 20, h: r.y + r.h - top - 16 };
}

// the blinking ▶ — the handheld cursor. Deterministic blink off `t` so a
// cold frame never pops: lit ~72% of a ~0.42s cycle.
export function cursorTri(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, c = INK) {
  const lit = (t * 2.4) % 1 < 0.72;
  ctx.save();
  ctx.globalAlpha = lit ? 1 : 0.25;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x + 8, y);
  ctx.lineTo(x, y + 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// a menu list row. Idle: INK text on the panel's paper. `on` (the selected
// or live row): INK slab + PARCH text + ▶. `hot` (armed two-tap): GOLD slab
// + INK text + ▶. `right` prints a right-aligned value; `sub` a dim second
// line under the label; `px` the label size.
export function uiRow(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  label: string,
  o: { on?: boolean; hot?: boolean; t?: number; right?: string; sub?: string; px?: number; align?: 'left' | 'center' } = {},
) {
  const cur = o.on || o.hot;
  if (cur) {
    rr(ctx, r.x, r.y, r.w, r.h, 5);
    ctx.fillStyle = o.hot ? GOLD : INK;
    ctx.fill();
  }
  const fg = o.on ? PARCH : INK;
  const pa = ctx.textAlign;
  const cx = o.align === 'center' ? r.x + r.w / 2 : r.x + (cur ? 18 : 8);
  ctx.textAlign = o.align === 'center' ? 'center' : 'left';
  ctx.fillStyle = fg;
  ctx.font = fontB(8);
  const rightW = o.right ? meas(ctx, o.right) + 10 : 0;
  ufit(ctx, label, o.px ?? 9, r.w - (cur ? 26 : 16) - rightW);
  ctx.fillText(label, cx, r.y + r.h / 2 + (o.sub ? -1 : 4));
  if (o.sub) {
    ctx.font = fontB(6.5);
    ctx.fillStyle = o.on ? '#a8b0d0' : INK_FAINT;
    ctx.fillText(o.sub, cx, r.y + r.h / 2 + 12);
  }
  if (o.right) {
    ctx.textAlign = 'right';
    ctx.font = fontB(8);
    ctx.fillStyle = o.on ? PARCH : INK_SOFT;
    ctx.fillText(o.right, r.x + r.w - 8, r.y + r.h / 2 + 3);
  }
  if (cur && o.t !== undefined) cursorTri(ctx, r.x + 7, r.y + r.h / 2, o.t, o.hot ? INK : PARCH);
  ctx.textAlign = pa;
}

// the × chip at a window's top-right — INK square, PARCH mark. Tap target
// stays wherever the caller's CLOSE rect already is; this is only the look.
export function uiClose(ctx: CanvasRenderingContext2D, r: Rect) {
  ctx.fillStyle = INK;
  rr(ctx, r.x, r.y, r.w, r.h, 6);
  ctx.fill();
  ctx.strokeStyle = PARCH;
  ctx.lineWidth = 1.5;
  rr(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 5);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = PARCH;
  ctx.font = font(8);
  ctx.fillText('X', r.x + r.w / 2 + 1, r.y + r.h / 2 + 4);
}
