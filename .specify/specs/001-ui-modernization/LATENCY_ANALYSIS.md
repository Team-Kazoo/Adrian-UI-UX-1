# 延迟测量分析

**日期**: 2025-11-12
**问题**: 测量显示 6ms 延迟,但用户体感明显高于此

---

## 当前测量的范围

### getLatencyStats() 测量的是什么?

**代码位置**: [main.js:612-618](../../js/main.js#L612-L618)

```javascript
// Worklet 中记录时间戳
captureTime = currentTime * 1000  // pitch-worklet.js:548

// 主线程接收时间戳
receiveTime = audioContext.currentTime * 1000  // main.js:279

// 计算延迟
latency = receiveTime - captureTime  // main.js:614
```

**测量范围**:
```
麦克风输入 → Worklet.process() → YIN算法 → postMessage → 主线程接收
             ↑                                              ↑
             captureTime                                    receiveTime

测量结果: 6ms (p50)
```

**包含的延迟**:
1. ✅ Worklet 处理时间 (YIN + FFT + EMA): ~2-3ms
2. ✅ postMessage 传输时间: ~1-2ms
3. ✅ 线程切换开销: ~1ms

**不包含的延迟**:
1. ❌ 麦克风输入延迟 (ADC)
2. ❌ AudioContext.baseLatency (~5ms)
3. ❌ 合成器处理时间 (Tone.js)
4. ❌ AudioContext.outputLatency (输出缓冲)
5. ❌ 扬声器延迟 (DAC)

---

## 完整的端到端延迟链路

### 实际音频路径

```
[1] 声音 → 麦克风 (物理)
    ↓ 延迟: 0-5ms (麦克风响应时间)

[2] 麦克风 → ADC (模数转换)
    ↓ 延迟: 5-10ms (硬件延迟)

[3] AudioContext Input Buffer
    ↓ 延迟: baseLatency = 5.35ms (从控制台日志)

[4] Worklet.process() - YIN算法
    ↓ 延迟: 2-3ms (处理时间)
    ↓ ⬅️ [当前测量起点: captureTime]

[5] postMessage → 主线程
    ↓ 延迟: 1-2ms (线程通信)
    ↓ ⬅️ [当前测量终点: receiveTime]

[6] 主线程 processPitchFrame()
    ↓ 延迟: 1-2ms (JS 执行)

[7] Tone.js 合成器处理
    ↓ 延迟: 5-15ms (滤波器、包络、效果)

[8] AudioContext Output Buffer
    ↓ 延迟: outputLatency (需要查询)

[9] DAC (数模转换) → 扬声器
    ↓ 延迟: 5-10ms (硬件延迟)

[10] 扬声器 → 耳朵 (物理)
     延迟: 1-3ms (声音传播)
```

### 延迟估算

| 阶段 | 延迟 (ms) | 备注 |
|------|-----------|------|
| 麦克风响应 | 0-5 | 取决于麦克风质量 |
| ADC | 5-10 | 硬件固定 |
| AudioContext Input | 5.35 | baseLatency (实测) |
| **Worklet处理** | **6** | **getLatencyStats() 测量** |
| 主线程处理 | 1-2 | JS 执行 |
| Tone.js 合成 | 5-15 | 滤波器、效果 |
| AudioContext Output | 5-20 | outputLatency (未知) |
| DAC + 扬声器 | 5-10 | 硬件固定 |
| 声音传播 | 1-3 | 物理延迟 |
| **总计** | **33-81ms** | **保守估计** |

**可能更高的原因**:
- iPhone 麦克风延迟可能更高 (10-20ms)
- 蓝牙耳机会增加 100-200ms
- 浏览器音频栈额外开销
- Tone.js 复杂效果链

---

## 如何获取完整延迟数据?

### 方法 1: 查询 AudioContext 延迟

在浏览器控制台执行:

```javascript
// 获取完整延迟信息
window.container.get('audioIO').getLatencyInfo()

// 或者直接访问 AudioContext
const ctx = window.container.get('audioIO').audioContext
console.log({
  baseLatency: ctx.baseLatency * 1000,      // 输入延迟
  outputLatency: ctx.outputLatency * 1000,  // 输出延迟
  sampleRate: ctx.sampleRate
})
```

### 方法 2: 物理测量 (金标准)

**工具**: 手机录像 + 音频编辑软件

1. 用手机录制屏幕 + 声音
2. 对着麦克风发出清晰的"哒"声
3. 观察波形:
   - 输入波形 (你的声音)
   - 输出波形 (扬声器发出的合成音)
4. 测量两个波形的时间差

**这是唯一准确的端到端延迟测量方法**

---

## 下一步建议

### 立即测试 (诊断)

请在浏览器控制台执行:

```javascript
// 1. 获取 AudioContext 延迟信息
window.container.get('audioIO').getLatencyInfo()

// 2. 获取基础延迟
const ctx = window.container.get('audioIO').audioContext
console.log('baseLatency:', ctx.baseLatency * 1000, 'ms')
console.log('outputLatency:', ctx.outputLatency * 1000, 'ms')

// 3. 获取当前设备信息
console.log('平台:', navigator.platform)
console.log('User Agent:', navigator.userAgent)
```

### 改进测量 (开发)

需要实现真正的端到端测量:

```javascript
// 理想的测量点
[1] 麦克风输入时间戳 (尽可能早)
    ↓
[2] 合成器输出时间戳 (Tone.js 输出后)
    ↓
真实延迟 = [2] - [1]
```

但这需要修改代码,在合成器输出处记录时间戳。

---

## 结论

**当前测量 (6ms)**:
- ✅ 准确测量了 Worklet 处理延迟
- ❌ 不代表端到端延迟

**实际端到端延迟估计**:
- **最佳情况**: 50-80ms (有线耳机,低延迟硬件)
- **典型情况**: 100-150ms (普通硬件)
- **最坏情况**: 200-300ms (蓝牙耳机,高延迟浏览器)

**PROJECT_STATUS.md 的 180ms**:
- 可能是之前用其他方法测量的
- 或者是包含了更多环节的估算
- **需要用户提供完整的诊断数据才能确认**

---

## 用户反馈

**体感**: 延迟明显高于 6ms ✅ 符合预期

**原因**: getLatencyStats() 只测量了处理延迟,不包括硬件延迟

**下一步**: 需要用户运行诊断命令获取完整延迟数据
