# React Migration Testing Guide

## 快速测试步骤

### 1. 启动开发服务器

```bash
npm start
```

浏览器访问: http://localhost:5173/

### 2. 检查初始化状态

**预期看到:**
- ✅ 页面加载无错误
- ✅ 控制台显示: `[Audio] System ready ✓`
- ✅ 状态显示: "Ready - Click Start to begin"
- ✅ 乐器选择面板可点击（不是灰色）

**如果乐器按钮是灰色:**
- 检查控制台是否有错误
- 检查 `disabled={!audio.isReady}` 是否为 true
- 等待几秒让音频系统初始化

### 3. 测试基本功能

#### Test 1: 开始/停止
1. 点击 "Start Playing" 按钮
2. 浏览器会请求麦克风权限 → **允许**
3. 预期:
   - ✅ 状态变为 "Playing (saxophone)"
   - ✅ 按钮变为 "Stop"
   - ✅ 实时可视化区域显示

4. 对着麦克风唱/哼一个音（如"啊~~~~"）
5. 预期:
   - ✅ 听到 saxophone 声音
   - ✅ 显示当前音高（如 "C4", "220.0 Hz"）

6. 点击 "Stop" 按钮
7. 预期:
   - ✅ 音频停止
   - ✅ 状态回到 "Ready"

#### Test 2: 切换乐器
1. 点击 "Start Playing"
2. 允许麦克风权限
3. 点击 "Violin" 乐器按钮
4. 再次唱一个音
5. 预期:
   - ✅ 声音立即从 saxophone 变为 violin
   - ✅ 状态显示 "Playing (violin)"

#### Test 3: 模式切换（可选）
1. 在 Header 区域找到模式切换开关
2. 切换 "Continuous" / "Traditional" 模式
3. 预期:
   - ✅ 模式切换无报错
   - ✅ 音频行为改变（continuous = 持续音，traditional = 断音）

### 4. 控制台检查

**正常启动时应该看到:**
```
[Audio] Loading audio libraries...
[Audio] Initializing audio system...
[Audio] main.js loaded
[Main] 依赖注入容器初始化完成
[Audio] System ready ✓
```

**点击 Start 后应该看到:**
```
[Audio] Starting audio...
[Audio] Tone.js AudioContext resumed
[Audio] Started successfully
```

**不应该看到:**
- ❌ "Audio system not initialized"
- ❌ "AudioContext was not allowed to start"（在点击按钮后）
- ❌ TypeScript 编译错误

### 5. 已知问题

#### 问题: Tone.js AudioContext 警告
**症状**: 控制台显示 "The AudioContext was not allowed to start"

**原因**: 浏览器安全限制，AudioContext 必须在用户手势（点击）后启动

**解决**: 这是正常的，只要点击 "Start Playing" 后能正常工作即可

#### 问题: Vite 动态导入警告
**症状**: 控制台显示 "The above dynamic import cannot be analyzed by Vite"

**原因**: Vite 无法静态分析 `/js/main.js` 的导入

**解决**: 已添加 `@vite-ignore` 注释，可以忽略此警告

#### 问题: Source map 警告
**症状**: "Failed to load source map for /js/lib/tone.js"

**原因**: Tone.js 库缺少 source map 文件

**解决**: 不影响功能，可以忽略

### 6. 性能检查（可选）

在浏览器控制台运行:

```javascript
// 检查延迟
window.app.getLatencyStats()

// 检查音频模式
window.container.get('audioIO').mode
// 应该返回: 'worklet' (最佳) 或 'script-processor' (回退)

// 查看所有服务
window.container.getServiceNames()
```

## 测试通过标准

- ✅ 页面加载无错误
- ✅ 音频系统初始化成功
- ✅ 可以选择乐器
- ✅ 点击 Start 后能听到声音
- ✅ 实时音高检测显示正确
- ✅ 乐器切换立即生效
- ✅ Stop 按钮正常工作

## 如果测试失败

1. 检查控制台错误信息
2. 确认麦克风权限已授予
3. 尝试刷新页面重新测试
4. 检查 Chrome/Firefox/Safari 版本是否支持 Web Audio API
5. 如果问题持续，提供控制台完整日志

## 调试命令

```bash
# 清理缓存重新构建
rm -rf dist node_modules/.vite
npm start

# 运行测试
npm test

# 查看 TypeScript 类型错误
npx tsc --noEmit
```
