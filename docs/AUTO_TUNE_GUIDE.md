# Auto-Tune (Pitch Correction) 使用指南

## 什么是 Auto-Tune?

Auto-Tune 是一个音高修正功能,可以将你唱出的音高自动"吸附"到最近的正确音符上,让演奏听起来更加准确。

就像歌手录音时使用的修音软件一样,它会帮你纠正跑调的音符!

**v0.4.1 更新注意**: API 已变更为 "Retune Speed" (修正速度) 模式，与旧版 "Correction Amount" (修正强度) 逻辑不同。

## 核心功能

### 1. 音高量化 (Pitch Quantization)

将检测到的频率自动修正到最近的音符:
- **输入**: 442Hz (稍微跑调的A4)
- **输出**: 440Hz (标准的A4)

### 2. 可调修正速度 (Retune Speed)

控制音高修正的速度 (注意：这与传统的"强度"混合不同):
- **0% (Robot)**: 瞬间吸附 (0ms)，产生 T-Pain 式的"电音"效果。
- **50%**: 中等速度，平衡音准与自然度。
- **100% (Natural)**: 慢速修正 (约200ms)，保留自然的滑音和颤音，只在长音时修正音准。

### 3. 迟滞处理 (Hysteresis)

- 智能防止在两个音符之间快速跳动。
- 只有当你明显唱到下一个音符时，系统才会切换目标音符。

### 4. 音阶过滤

只修正到特定音阶内的音符:
- **全音阶** (CHROMATIC): 所有12个半音
- **大调** (MAJOR): 如C大调 (C D E F G A B)
- **小调** (MINOR): 如A小调 (A B C D E F G)
- **五声音阶**: 中国传统五声或布鲁斯

## 使用方法

### 浏览器控制台

打开浏览器控制台(F12),然后:

```javascript
// 获取合成器实例
const synth = window.container.get('continuousSynthEngine');

// ===== 基本使用 =====

// 1. 启用 Auto-Tune (0% Speed = Robot Mode)
synth.setAutoTune(true, 0.0);

// 2. 关闭 Auto-Tune
synth.setAutoTune(false);

// ===== 高级设置 =====

// 设置为自然模式 (100% Speed = Natural)
synth.setAutoTune(true, 1.0);

// 设置为平衡模式 (50% Speed)
synth.setAutoTune(true, 0.5);

// 设置为C大调音阶
synth.setAutoTuneScale('MAJOR', 'C');

// 设置为A小调音阶
synth.setAutoTuneScale('MINOR', 'A');

// 设置为中国五声音阶 (C调)
synth.setAutoTuneScale('PENTATONIC_MAJOR', 'C');

// 布鲁斯音阶
synth.setAutoTuneScale('BLUES', 'E');

// ===== 查看统计 =====

// 查看修正统计信息
console.log(synth.getAutoTuneStats());
// 输出: { processedCount, correctedCount, avgCentsError, ... }
```

## 可用音阶

| 音阶类型 | 代码 | 说明 | 音符数 |
|---------|------|------|-------|
| 全音阶 | `CHROMATIC` | 所有半音 | 12 |
| 大调 | `MAJOR` | 明亮欢快 (如C大调) | 7 |
| 小调 | `MINOR` | 忧郁深沉 (如A小调) | 7 |
| 大调五声 | `PENTATONIC_MAJOR` | 中国传统五声 | 5 |
| 小调五声 | `PENTATONIC_MINOR` | 民谣布鲁斯 | 5 |
| 布鲁斯 | `BLUES` | 蓝调音阶 | 6 |

## 常用调号

| 调号 | 说明 | 常见音阶 |
|-----|------|---------|
| C | C调 | C大调、A小调 |
| D | D调 | D大调、B小调 |
| E | E调 | E大调、C#小调 |
| F | F调 | F大调、D小调 |
| G | G调 | G大调、E小调 |
| A | A调 | A大调、F#小调 |

## 使用建议

### 适合使用 Auto-Tune 的场景

✅ **初学者练习**: 帮助你快速找到正确的音高
✅ **演奏歌曲**: 让你的演奏听起来更专业
✅ **录音**: 修正小瑕疵,提升录音质量

### 推荐参数 (Retune Speed)

| 使用场景 | Retune Speed | 效果 |
|---------|--------------|------|
| 特殊效果 (Trap/Hip-hop) | 0% (Robot) | 瞬间吸附，强烈的电音感 |
| 流行歌曲演奏 | 20% - 50% | 快速修正，但保留一定人性化 |
| 自然人声/练习 | 80% - 100% | 慢速修正，极其自然，仅辅助音准 |

## 示例场景

### 场景1: 练习C大调歌曲 (自然辅助)

```javascript
// 设置C大调, 80% 速度 (自然)
synth.setAutoTune(true, 0.8);
synth.setAutoTuneScale('MAJOR', 'C');

// 现在你唱的音会自动修正到C大调音阶
// 听起来很自然，不会有机器人的感觉
```

### 场景2: 模仿T-Pain效果 (电音)

```javascript
// 0% 速度 (Robot)
synth.setAutoTune(true, 0.0);
synth.setAutoTuneScale('CHROMATIC', 'C');

// 这会产生明显的"机器人"音效
// 就像T-Pain的自动调音效果
```

## 技术细节

### 算法流程 (v0.4.1 更新)

1. **检测**: 从麦克风检测原始音高 (例如: 442Hz)
2. **迟滞判断**: 检查输入是否偏离当前音符超过阈值 (0.6半音)，防止抖动。
3. **目标计算**: 找到最近的音阶内音符。
4. **平滑处理 (Time-based Smoothing)**: 
   - 使用指数平滑算法，根据 `Retune Speed` 决定向目标音高移动的速度。
   - Speed 0% -> Tau ≈ 0ms (瞬间)
   - Speed 100% -> Tau ≈ 200ms (慢速)
5. **输出**: 输出平滑后的频率。

### 性能指标

- **CPU开销**: < 0.1ms (纯数学计算)
- **延迟**: < 1ms (不影响实时性)
- **内存占用**: < 1KB

## 故障排查

### Q: Auto-Tune不起作用?

A: 检查以下几点:
1. 确认已调用 `setAutoTune(true, speed)`
2. 检查 `autotuneEnabled` 状态: `synth.autotuneEnabled`

### Q: 为什么没有那种"电音"味?

A: 你的速度设置太慢了。请将 `Retune Speed` 设为 `0` (0%)。

### Q: 音高在两个音之间乱跳?

A: 这是"迟滞"在起作用，防止乱跳。但如果你唱得太不准（在两个音正中间），系统可能会困惑。尝试唱得更果断一点。

### Q: 如何查看是否生效?

A: 查看统计信息:
```javascript
const stats = synth.getAutoTuneStats();
console.log(`已修正: ${stats.correctedCount} 次`);
console.log(`平均误差: ${stats.avgCentsError.toFixed(1)} cents`);
```

---

**版本**: v0.4.2
**最后更新**: 2025-11-19