export function startLoop(update: (dt: number) => void, render: () => void) {
  let last = performance.now();
  const frame = (t: number) => {
    const dt = Math.min((t - last) / 1000, 1 / 30);
    last = t;
    requestAnimationFrame(frame); // first — a throw in update/render can't kill the loop
    update(dt);
    render();
  };
  requestAnimationFrame(frame);
}
