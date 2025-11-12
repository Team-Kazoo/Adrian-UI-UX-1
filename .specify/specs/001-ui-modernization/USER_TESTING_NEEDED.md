# 🧪 用户测试清单

**状态**: Phase 1 实施完成 + 延迟测量 Bug 已修复 ✅
**分支**: `feature/001-ui-modernization`
**更新时间**: 2025-11-12 (最后修复: d61e3c5)

## 🔧 重要修复 (2025-11-12)

### 修复 #1: captureTime 缺失 (d61e3c5) ✅
**问题**: `window.app.getLatencyStats()` 返回 `{count: 0}` (无数据)
**原因**: `pitch-worklet.js` 的 `pitchInfo` 缺少 `captureTime` 字段
**修复**: 添加 `captureTime: currentTime * 1000` 到 PitchFrame

### 修复 #2: 时间源不一致 (9ac3995) ✅
**问题**: 延迟显示 38,778ms (38秒!),应该是 ~180ms
**原因**: 时间源不一致
  - Worklet: `currentTime` (AudioContext 时间)
  - Main: `performance.now()` (页面加载时间)
**修复**: 主线程改用 `audioContext.currentTime * 1000` (main.js:279)

**现在应该正常了!** 期望延迟: 100-200ms

---

## ⚠️ 高优先级:T001 基准延迟测量(阻塞所有阶段)

**为什么重要**: 这是性能第一原则的基石。没有基准数据,无法评估后续任何改动的性能影响。

**测试步骤**:
```bash
npm start
# 打开 http://localhost:3000
```

1. 点击 "Start Playing" 按钮
2. 允许麦克风权限
3. 哼唱或歌唱 **30秒** (需要足够样本)
4. 打开浏览器控制台 (F12)
5. 执行以下命令:
```javascript
window.app.getLatencyStats()
```

**期望结果**: 约 180ms (根据 PROJECT_STATUS.md)

**记录数据**:
- `p50` (中位数): _____ms
- `p95` (95百分位): _____ms
- `p99` (99百分位): _____ms
- 浏览器版本: _____
- 操作系统: _____

**记录位置**: 将结果粘贴到 [research.md](./research.md) 的 T001 部分

---

## 📋 Phase 1 验证测试 (T016-T019)

### T016: 视觉测试 - Hero 区域现代化

**期望看到**:
- ✅ Hero 区域有蓝色到靛蓝色的渐变背景 (`from-blue-50 to-indigo-100`)
- ✅ 圆角卡片效果 (`rounded-2xl`)
- ✅ 标题字体大且加粗 (`text-4xl md:text-5xl font-bold`)
- ✅ 副标题文字清晰 (`text-lg md:text-xl text-gray-600`)
- ✅ Badge 是圆角胶囊形状 (`rounded-full`)
- ✅ 整体布局居中且间距合理

**测试方法**: 浏览 http://localhost:3000,用眼睛检查

**结果**: ⬜ 通过 / ⬜ 失败 (如果失败,描述问题:_______)

---

### T017: 功能测试 - 音频功能完整性

**目的**: 确认 Tailwind CSS 没有破坏 JavaScript 音频逻辑

**测试步骤**:
1. 点击 "Start Playing" 按钮
2. 允许麦克风权限
3. 哼唱简单旋律 (如 Do-Re-Mi-Fa-Sol)
4. 确认听到乐器声音(默认萨克斯)
5. 点击 "Stop" 按钮
6. 确认音频停止

**期望结果**:
- ✅ 麦克风权限请求正常
- ✅ 听到实时乐器声音
- ✅ Stop 按钮生效
- ✅ 无浏览器控制台错误

**结果**: ⬜ 通过 / ⬜ 失败 (如果失败,描述问题:_______)

---

### T018: 单元测试 - 代码回归测试

**测试命令**:
```bash
npm test
```

**期望结果**: 所有测试通过 (约 67 个测试)

**实际结果**: _____ / _____ 测试通过

**结果**: ⬜ 通过 / ⬜ 失败 (如果失败,贴出错误日志)

---

### T019: 延迟测试 - 性能回归检查

**测试步骤** (与 T001 相同):
```bash
npm start
```

1. 启动音频
2. 哼唱 30 秒
3. 浏览器控制台执行:
```javascript
window.app.getLatencyStats()
```

**期望结果**: ≤ 190ms (基准 180ms + 10ms 容差)

**记录数据**:
- `p50`: _____ms (期望 ≤ 190ms)
- `p95`: _____ms (期望 ≤ 200ms)
- `p99`: _____ms (期望 ≤ 220ms)

**结果**: ⬜ 通过 / ⬜ 失败

---

## 🚦 下一步判断

### 如果 T001 + T016-T019 全部通过 ✅

**执行**:
```bash
git status  # 确认当前分支
```

**回复 Claude Code**:
```
测试结果:
- T001: ✅ 通过 (基准延迟: p50=___ms, p95=___ms, p99=___ms)
- T016: ✅ 通过 (视觉正常)
- T017: ✅ 通过 (音频功能正常)
- T018: ✅ 通过 (67/67 测试通过)
- T019: ✅ 通过 (延迟: p50=___ms, p95=___ms, p99=___ms)

请继续 Phase 2 (导航栏和乐器卡片现代化)
```

Claude 将会:
1. 更新 `research.md` 记录 T001 基准数据
2. 更新 `tasks.md` 标记 T016-T019 为完成
3. 开始实施 Phase 2 (T020-T037)

---

### 如果任何测试失败 ❌

**立即停止,不要继续 Phase 2**

**回复 Claude Code**:
```
测试结果:
- T001: ⬜ 通过 / ❌ 失败 (详细结果)
- T016: ⬜ 通过 / ❌ 失败 (问题描述)
- T017: ⬜ 通过 / ❌ 失败 (问题描述)
- T018: ⬜ 通过 / ❌ 失败 (测试输出)
- T019: ⬜ 通过 / ❌ 失败 (延迟数据)

请帮我调试失败的测试
```

Claude 将会:
1. 分析失败原因
2. 提供修复方案
3. 必要时回滚代码 (`git reset --hard 983e730`)

---

## 📊 当前 Git 状态

```bash
# 最新提交
git log --oneline -3
```

应该看到:
```
05b1d4f Clean up redundant Hero CSS classes after Tailwind migration
561bf8f Add session resumption guide for next conversation
4bfad66 Add progress tracking document
```

---

## 💡 快速故障排查

### 延迟增加 > 10ms (T019 失败)
- **可能原因**: Tailwind CDN 加载时间影响
- **检查**: `Network` 标签中查看 `cdn.tailwindcss.com` 加载时间
- **解决**: 可能需要改用本地 Tailwind 构建

### 音频功能损坏 (T017 失败)
- **检查**: 浏览器控制台是否有 JavaScript 错误
- **检查**: `<script>` 标签顺序是否正确
- **检查**: Tailwind 配置是否意外覆盖了 JavaScript

### 单元测试失败 (T018 失败)
- **运行详细测试**: `npm test -- --reporter=verbose`
- **检查**: 是否是测试本身的问题,而非代码问题

### 视觉不符预期 (T016 失败)
- **检查**: 浏览器是否加载了 Tailwind CDN
- **检查**: `index.html` 的 Tailwind 类名是否正确
- **检查**: 浏览器缓存问题 (Ctrl+Shift+R 强制刷新)

---

**测试时间估计**: 15-20 分钟

**祝测试顺利!有问题随时问 Claude Code!** 🚀
