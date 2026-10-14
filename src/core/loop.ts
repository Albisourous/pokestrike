export function startLoop(update: (dt: number) => void, render: () => void) {
  let last = performance.now();
  const frame = (t: number) => {
    const dt = Math.min((t - last) / 1000, 1 / 30);
    last = t;
    update(dt);
    render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
