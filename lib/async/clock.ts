/** 较为准确的控制时间 */
export class Clock {
  private timerRaf = 0;

  private isStop = false;

  get isStopped() {
    return this.isStop;
  }

  stop = () => {
    this.isStop = true;
  };

  run = (
    startTime: number,
    cb: (newTime: number, timeDiff: number) => void
  ) => {
    window.cancelAnimationFrame(this.timerRaf);
    this.isStop = false;
    const initTime = Date.now();
    const _run = () => {
      if (!this.isStop) {
        this.timerRaf = window.requestAnimationFrame(_run);
        const timeDiff = Date.now() - initTime;
        cb(startTime + timeDiff, timeDiff);
      }
    };
    this.timerRaf = window.requestAnimationFrame(_run);
    return {
      stop: () => this.stop(),
    };
  };
}
