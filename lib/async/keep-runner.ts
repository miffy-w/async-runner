export class KeepRunner {
  private running = false;
  constructor(private fn?: Function) {
    this.run = this.run.bind(this);
    this.stop = this.stop.bind(this);
  }
  private isStopped = false;
  async run(fn?: Function) {
    if (typeof fn === 'function') this.fn = fn;
    if (this.running || this.isStopped) return;
    this.running = true;
    while (!this.isStopped) {
      await this.fn?.();
    }
  }
  get stopped() {
    return this.isStopped;
  }

  get isRunning() {
    return this.running;
  }

  stop() {
    this.fn = void 0;
    this.running = false;
    this.isStopped = true;
  }
}
