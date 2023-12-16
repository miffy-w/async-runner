import { KeepRunner } from './keep-runner';
import { sleep } from './sleep';

describe('keep-runner 测试', () => {
  const obj = { count: 1 };
  const runner = new KeepRunner(async () => {
    await sleep(1000);
    obj.count += 1;
  });

  it('runner 是否没有停止', () => {
    expect(runner.stopped).toBe(false);
  });

  it('runner 是否还没有启动', () => {
    expect(runner.isRunning).toBe(false);
  });

  it('runner 是否已经启动', async () => {
    runner.run();
    expect(runner.isRunning).toBe(true);
  });

  it('count 是否等于 1', () => {
    expect(obj.count).toBe(1);
  });

  it('经过 3s 后 count 是否大于等于 3', async () => {
    await sleep(3000);
    expect(obj.count).toBeGreaterThanOrEqual(3);
  });

  it('runner 是否已经停止', () => {
    runner.stop();
    expect(runner.stopped).toBe(true);
  });

  it('再次调用 run 方法，检查是否还是已经停止状态', () => {
    runner.run();
    expect(runner.stopped).toBe(true);
  });

  it('再次调用 run 方法，检查 isRunning 状态是否是 false', () => {
    runner.run();
    expect(runner.isRunning).toBe(false);
  });

  it('runner 停止后，count 的值是否还在增加', async () => {
    const prevCount = obj.count;
    await sleep(4000); // obj.count 可能等于 currentCount + 1，因为停止后，fn 可能还在执行
    expect(obj.count - prevCount).toBeLessThanOrEqual(1);
  });
});
