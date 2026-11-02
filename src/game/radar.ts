import { itemSprite, loadItem } from '../core/assets';
import { mulberry32 } from '../core/rng';
import type { Telops } from './telop';
import { GOLD_HI, INK, fontB, uiWindow } from './ui';

export const RADAR_STEP = 0.02;
export const RADAR_CAP = 0.2;
export const RADAR_TELOP = 5;

interface RadarEnemy {
  uid: number;
  boss?: boolean;
  shiny: boolean;
  def: { id: number; name: string };
}

export class Radar {
  id = 0;
  n = 0;
  private name = '';

  reset() {
    this.id = this.n = 0;
    this.name = '';
  }

  ko(e: RadarEnemy, telop: Telops) {
    if (this.n > 0 && e.def.id === this.id) this.n++;
    else {
      this.id = e.def.id;
      this.n = 1;
    }
    this.name = e.def.name;
    if (this.n === RADAR_TELOP) telop.push({ kind: 'combo', title: 'CHAIN ×5', sub: 'SHINY ODDS UP', mon: this.id, icon: 'poke-radar' });
  }

  bonus(id: number): number {
    return id === this.id && this.n > 0 ? Math.min(RADAR_CAP, this.n * RADAR_STEP) : 0;
  }

  spawn(enemies: RadarEnemy[], seed: number, rate: number) {
    for (const e of enemies) {
      if (e.boss || e.shiny || e.def.id !== this.id) continue;
      const rng = mulberry32((seed + e.uid * 7919) >>> 0);
      if (rng() < this.bonus(e.def.id) * rate) e.shiny = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D, arena: { x: number; y: number }) {
    if (this.n < 2) return;
    const label = `CHAIN ${this.name} ×${this.n}`;
    ctx.save();
    ctx.font = fontB(16);
    const c = { x: arena.x + 8, y: arena.y + 42, w: Math.ceil(ctx.measureText(label).width) + 42, h: 30 };
    uiWindow(ctx, c, { rad: 8 });
    void loadItem('poke-radar');
    const img = itemSprite('poke-radar');
    if (img) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, c.x + 8, c.y + 5, 20, 20);
    }
    ctx.textAlign = 'left';
    ctx.font = fontB(16);
    ctx.fillStyle = INK;
    ctx.fillText(label, c.x + 34, c.y + 21);
    ctx.fillStyle = GOLD_HI;
    ctx.fillRect(c.x + 8, c.y + c.h - 6, c.w - 16, 2);
    ctx.restore();
  }
}
