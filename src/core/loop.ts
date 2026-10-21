import { settings } from '../game/meta';

export function startLoop(update: (dt: number) => void, render: () => void) {
  let last = performance.now();
  let odd = false;
  const frame = (t: number) => {
    requestAnimationFrame(frame); // first — a throw in update/render can't kill the loop
    // battery saver: every other rAF does nothing — `last` stays put so the
    // next live frame's dt still spans real elapsed time (sim keeps speed)
    if (settings().battery && (odd = !odd)) return;
    const dt = Math.min((t - last) / 1000, 1 / 30);
    last = t;
    update(dt);
    render();
  };
  requestAnimationFrame(frame);
}
