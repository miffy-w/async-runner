import { KeepRunner } from './keep-runner';
import { sleep } from './sleep';

export interface LoopRunnerOptions<M, R = any> {
  /** 一次处理多少成员，默认：50 条 */
  size?: number;
  /** 每次轮询的间隔时间，单位：ms，默认：10s */
  interval?: number;
  /** 一开始是否先执行一次（不延迟），默认：true */
  immediately?: boolean;
  /** 轮询回调 */
  onLoop: (members: M[], size: number, index: number) => R | Promise<R>;
  /** addMembers 之后，是否直接把 index 转到新的 members 开始循环，默认：true */
  updateIdxWhenAddingMembers?: boolean;
  /** 执行方式，默认：并行 */
  runType?: 'serial' | 'parallel';
  /** 当成员已经轮询过，是否删除他们，默认：false */
  removeLoopedMembers?: boolean;
  /** 每次更新 members 时触发的回调 */
  onUpdateMembers?: (newMembers: Set<M>) => void;
}

export class LoopRunner<M, R = any> {
  /** 是否暂停 */
  private isPause = false;

  /** 是否停止 */
  private isStopped = false;

  /** 当前的索引位置 */
  private curIndex = 0;

  /** 是否已经调用了 running */
  private running = false;

  /** 存储所有的待处理成员 */
  private members = new Set<M>();

  private timer: any = 0;

  private serialRuner = new KeepRunner();

  options: Readonly<Required<LoopRunnerOptions<M, R>>>;
  constructor(members: M[] = [], options?: LoopRunnerOptions<M, R>) {
    const DEFAULT_OPTIONS: Required<LoopRunnerOptions<M, R>> = {
      size: 50,
      interval: 10000,
      immediately: true,
      onLoop: () => null as R,
      runType: 'parallel',
      onUpdateMembers: () => {},
      removeLoopedMembers: false,
      updateIdxWhenAddingMembers: true,
    };

    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.members = new Set(members);
    this.run = this.run.bind(this);
    this.stop = this.stop.bind(this);
    this.pause = this.pause.bind(this);
    this.dispatch = this.dispatch.bind(this);
    this.addMembers = this.addMembers.bind(this);
    this.serialRun = this.serialRun.bind(this);
    this.cannotLoop = this.cannotLoop.bind(this);
    this.delMembers = this.delMembers.bind(this);
    this.parallelRun = this.parallelRun.bind(this);
    this.restartByIdx = this.restartByIdx.bind(this);
  }

  get paused() {
    return this.isPause;
  }
  get stopped() {
    return this.isStopped;
  }
  get currentIdx() {
    return this.curIndex;
  }
  get membersSet() {
    return new Set(this.members);
  }
  get memberList() {
    return Array.from(this.members);
  }

  /** 暂停切换，如果不传参数，就把上一次的取反，true 代表暂停 */
  pause(flag?: boolean) {
    const newState = flag ?? !this.isPause;
    this.isPause = newState;
    if (!newState && !this.isStopped) {
      this.run();
    }
  }

  /** 从某个索引重新开始，默认：idx = 0 */
  restartByIdx(idx = 0) {
    this.curIndex = idx >= this.members.size ? 0 : idx;
  }

  private _updateMembers(members: Set<M>) {
    this.members = members;
    this.options.onUpdateMembers(members);
  }

  stop() {
    this.curIndex = 0;
    this.running = false;
    this.isStopped = true;
    this._updateMembers(new Set());
    clearInterval(this.timer);
    this.serialRuner.stop();
  }

  addMembers(members: M[]) {
    const prevMembers = Array.from(this.members);
    this._updateMembers(new Set([...prevMembers, ...members]));
    if (
      this.options.updateIdxWhenAddingMembers &&
      prevMembers.length < this.members.size
    ) {
      this.curIndex = prevMembers.length;
    }
  }

  /** 是不是不能再循环了，暂停或者终止或者 members 列表是空 */
  cannotLoop() {
    return this.isPause || this.isStopped || !this.members.size;
  }

  /** 删除成员 */
  delMembers(members: M[]) {
    members.forEach((member) => {
      if (this.members.has(member)) this.members.delete(member);
    });
    this._updateMembers(this.members);
  }

  /** 调度一次，如果暂停或者停止了，则不会被调度 */
  async dispatch() {
    if (this.cannotLoop()) return;
    const { size, onLoop, removeLoopedMembers } = this.options;
    const allMembers = Array.from(this.members);
    const totalSize = allMembers.length;
    if (this.curIndex >= totalSize) {
      this.curIndex = 0; // 先判断一下索引是否准确
    }
    /** 当前要轮询的成员 */
    let endIdx = this.curIndex + size;
    const curMembers = allMembers.slice(this.curIndex, endIdx);
    const curMembersSize = curMembers.length;
    /** curMembers 的长度可能不到 size 大小，这是就回到第 0 未截取没有排满的成员 */
    if (curMembersSize < size && totalSize > size) {
      const restSize = Math.min(size - curMembersSize, this.curIndex);
      curMembers.push(...allMembers.slice(0, restSize));
      endIdx = restSize;
    }

    const oldIndex = this.curIndex;
    if (removeLoopedMembers) {
      // 如果要删除轮询过的成员
      this.delMembers(curMembers); // 更新 curIndex，下次直接从 0 开始即可
      this.curIndex = 0;
    } else {
      this.curIndex = endIdx >= totalSize ? 0 : endIdx;
    }
    return onLoop(curMembers, curMembers.length, oldIndex);
  }

  /** 并行执行 */
  parallelRun() {
    /** 如果是串行，则无法进行并行 */
    if (!this.running) {
      this.running = true;
      const { runType } = this.options;
      if (runType !== 'parallel') {
        return console.error(
          `Your options.runType is '${runType}', cannot call 'parallelRun' function.`
        );
      }
      clearInterval(this.timer);
      if (this.options.immediately) this.dispatch();
      this.timer = setInterval(this.dispatch, this.options.interval);
    }
  }

  /** 串行执行 */
  async serialRun() {
    /** 如果是并行，则无法进行串行 */
    if (!this.running) {
      this.running = true;
      const { runType } = this.options;
      if (runType !== 'serial') {
        return console.error(
          `Your options.runType is '${runType}', cannot call 'serialRun' function.`
        );
      }
      this.serialRuner.stop();
      this.serialRuner = new KeepRunner();
      const { interval } = this.options;

      if (this.options.immediately) await this.dispatch();
      await this.serialRuner.run(async () => {
        interval > 0 && (await sleep(this.options.interval));
        await this.dispatch();
      });
    }
  }

  async run() {
    if (this.options.runType === 'serial') {
      await this.serialRun();
    } else {
      this.parallelRun();
    }
  }
}
