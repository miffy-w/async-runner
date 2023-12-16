# Async-Runner

异步运行库，主要包含：

- `clock`，一个基于 RAF 的定时器；
- `keep-runner`，传入的函数会被一直运行下去，知道手动 stop；
- `loop-runner`，用于循环执行；

下载

```bash
pnpm add @miffy-w/async-runner
```

## 1. `LoopRunner`

假如你有这么一个需求，有一个部门组织架构树，部门下面是所有的用户信息，当展开某个部门时可以分页查询该部门下的用户。

但是用户是否在线需要另一个接口去批量查询。我们想在用户展开部门时去收集获取的用户列表，然后调接口批量查询在线状态。当收集的用户信息太多时，我们需要分多次批量查询。

比如收集了 200 名用户信息，但接口最多一次查询 100 条，这时候我们就需要分两次查询，而 `LoopRunner` 就可以满足这个场景！

```ts
import { LoopRunner } from '@miffy-w/async-runner';

const members = new Array(10).fill(1).map((item, idx) => item + idx);

const loop = new LoopRunner<number, number>(members, {
  size: 50, // 每次查询 50 条数据
  interval: 6000, // 每过 6s 就查询一次数据
  runType: 'parallel', // 并行查询
  // 当轮询到来时，我们获取到轮询到的成员，然后调用接口更新
  async onLoop(members, size, index) {
    const statusList = await api.getOnlineState(members);
    // update members online status...
  },
});

// 开始轮询
loop.run();

setTimeout(() => {
  // 6s 之后可能又有新的成员需要添加进去
  loop.addMembers([11, 12, 13, 14, 15, 16, 17, 18]);
}, 6000);
```

`LoopRunner` 提供的能力：

1. 支持暂停（`loop.pause(true)`），当暂停后再启动会在轮询到的 index 处继续处理；
2. 支持并行（parallel）和串行（serial）两种方式；
3. 当轮询到最后不足指定的 size 时，自动填充前面的成员保证充分利用资源；
4. 支持单次轮询（轮询完成后清空列表成员）；

相关 API：

```ts
interface LoopRunnerOptions<M, R = any> {
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
```

## 2. `Clock`

如果你想在页面上较为准确的展示时钟或者较为准确的在某个时间段执行一些操作，`Clock` 函数是个不错的选择，它内部使用 `RAF` 和 相对时间来计算出新的时间点。

```ts
import { Clock } from '@miffy-w/async-runner';

const clock = new Clock();

/* 使用后台给的时间戳来更新页面上的时钟 */
clock.run(api.data.timestamp, (newTime) => {
  $('#systemTime').textContent = dayjs.format(newTime, 'YYYY-MM-DD HH:mm:ss');
});
```

另外，Clock 也可用于倒计时程序，比如后台给了一个时间戳，在这个时间内展示倒计时。比如下面的函数是一个简易的倒计时 `React hook`：

```ts
const useCountdown = (initTime: number) => {
  const [time, setTime] = useState(0);
  const clockRef = useRef(new Clock());
  useEffect(() => {
    // run 回调的第二个参数是 RAF 执行一次时的上一次的时间点减去当前时间点得到的
    clockRef.current.run(initTime, (_, timeDiff) => {
      const time = initTime - diffTime;
      if (time >= 0) {
        setTime(time);
      } else {
        clockRef.current.stop();
      }
    });
    return () => {
      clockRef.current.stop();
    };
  }, []);
  return time;
};
```
