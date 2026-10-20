/** Coalesce high-frequency UI work, with an explicit flush for pointer release. */
export function createFrameTask(run: () => void): { schedule(): void; flush(): void } {
  let frame = 0;
  const flush = () => {
    if (!frame) return;
    cancelAnimationFrame(frame);
    frame = 0;
    run();
  };
  return {
    schedule() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        run();
      });
    },
    flush,
  };
}
