import { Clock } from './clock';
import { sleep } from './sleep';

describe('clock.run 函数测试', () => {
  const fn = jest.fn();
  const clock = new Clock();
  clock.run(6000, fn);
  test('调用完 stop() 函数前 isStopped 属性是否是 false', () => {
    expect(clock.isStopped).toBe(false);
  });

  test('run 函数的回调函数是否执行了', async () => {
    await sleep(500);
    expect(fn).toHaveBeenCalled();
    clock.stop();
  });

  test('调用完 stop() 函数后 isStopped 属性是否是 true', () => {
    expect(clock.isStopped).toBe(true);
  });
});
