# Phase 2 完成指南

## 当前状态 (已完成 60%)

### ✅ 已完成：
1. 目录结构创建完成
2. TypeScript 类型定义完成 (`src/lib/types/audio.ts`)
3. `useAudioService` Hook 框架完成
4. AudioWorklet 已复制到 `public/`

### ⏳ 需要完成 (40%)：

## 选项 A：最快方案（推荐，30 分钟）

**策略：在 HTML 中加载旧 JS，React 通过 window 对象访问**

### 步骤：

#### 1. 修改 `index.html`，添加旧 JS 脚本

在 `</body>` 前添加：

```html
<!-- 旧音频系统（暂时保留，用于快速集成） -->
<script src="/js/lib/tone.js"></script>
<script src="/js/lib/pitchfinder-browser.js"></script>
<script type="module">
  // 简化的全局音频初始化
  import { KazooApp } from '/js/main.js'
  window.kazooApp = new KazooApp()
  await window.kazooApp.initialize()
  console.log('Legacy audio system loaded')
</script>
```

#### 2. 修改 `useAudioService.ts`

简化为直接使用 `window.kazooApp`:

```typescript
export function useAudioService() {
  const [audioState, setAudioState] = useState<AudioState>({...})

  useEffect(() => {
    // 等待 window.kazooApp 加载
    const checkReady = setInterval(() => {
      if ((window as any).kazooApp) {
        clearInterval(checkReady)
        setAudioState(prev => ({ ...prev, isReady: true }))
      }
    }, 100)

    return () => clearInterval(checkReady)
  }, [])

  const start = useCallback(async () => {
    await (window as any).kazooApp.start()
    setAudioState(prev => ({ ...prev, isPlaying: true }))
  }, [])

  // ... 其他控制函数
}
```

#### 3. 更新组件（见下方）

---

## 选项 B：完整重写（推荐长期，2-3 小时）

**策略：完全用 TypeScript 重写音频模块**

### 需要复制并转换的文件：

```bash
# 核心模块
cp js/audio-io.js src/lib/audio/AudioIO.ts
cp js/pitch-detector.js src/lib/audio/PitchDetector.ts
cp js/continuous-synth.js src/lib/audio/ContinuousSynth.ts
cp js/synthesizer.js src/lib/audio/Synthesizer.ts

# 配置
cp -r js/config/ src/lib/audio/config/
```

然后逐个添加 TypeScript 类型注解。

---

## 组件更新（两个选项都需要）

### 1. App.tsx

```typescript
import { useAudioService } from '@/hooks/useAudioService'

function App() {
  const audio = useAudioService()

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        currentMode={audio.currentMode}
        onModeChange={audio.changeMode}
      />

      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 max-w-7xl">
          <HeroSection
            isPlaying={audio.isPlaying}
            isReady={audio.isReady}
            status={audio.status}
            onStart={audio.start}
            onStop={audio.stop}
          />

          <InstrumentPalette
            currentInstrument={audio.currentInstrument}
            onInstrumentChange={audio.changeInstrument}
            disabled={!audio.isReady}
          />

          <LiveVisualizer
            isVisible={audio.isPlaying}
            pitchData={audio.pitchData}
            latency={audio.latency}
          />

          <Footer />
        </div>
      </main>
    </div>
  )
}
```

### 2. HeroSection.tsx 添加 props

```typescript
interface HeroSectionProps {
  isPlaying: boolean
  isReady: boolean
  status: string
  onStart: () => void
  onStop: () => void
}

export function HeroSection({ isPlaying, isReady, status, onStart, onStop }: HeroSectionProps) {
  return (
    <section>
      {/* ... */}
      <Button
        onClick={onStart}
        disabled={!isReady || isPlaying}
        className={isPlaying ? 'hidden' : ''}
      >
        Start Playing
      </Button>

      <Button
        onClick={onStop}
        disabled={!isPlaying}
        className={!isPlaying ? 'hidden' : ''}
      >
        Stop
      </Button>

      <p>{status}</p>
    </section>
  )
}
```

### 3. InstrumentPalette.tsx 添加 props

```typescript
interface InstrumentPaletteProps {
  currentInstrument: string
  onInstrumentChange: (instrument: string) => void
  disabled?: boolean
}

export function InstrumentPalette({ currentInstrument, onInstrumentChange, disabled }: InstrumentPaletteProps) {
  return (
    <Card>
      {instruments.map((inst) => (
        <button
          key={inst.id}
          onClick={() => onInstrumentChange(inst.id)}
          disabled={disabled || inst.disabled}
          className={cn(
            currentInstrument === inst.id && 'border-blue-500 ring-2'
          )}
        >
          {/* ... */}
        </button>
      ))}
    </Card>
  )
}
```

### 4. LiveVisualizer.tsx 添加 props

```typescript
interface LiveVisualizerProps {
  isVisible: boolean
  pitchData: { note: string; frequency: number; confidence: number } | null
  latency: number
}

export function LiveVisualizer({ isVisible, pitchData, latency }: LiveVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 绘制音高曲线
  useEffect(() => {
    if (!isVisible || !pitchData) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    // ... 绘制逻辑
  }, [isVisible, pitchData])

  return (
    <div className={isVisible ? '' : 'hidden'}>
      <Card>
        <div id="currentNote">{pitchData?.note || '--'}</div>
        <div id="currentFreq">{pitchData?.frequency.toFixed(1)} Hz</div>
        <canvas ref={canvasRef} />
        <div id="latency">{latency}ms</div>
      </Card>
    </div>
  )
}
```

---

## 测试清单

- [ ] `npm start` 启动无错误
- [ ] 点击 Start 按钮请求麦克风权限
- [ ] 唱一个音能听到 saxophone 声音
- [ ] 切换乐器（如 violin）声音立即改变
- [ ] 可视化器显示实时音高
- [ ] 点击 Stop 按钮停止播放

---

## 提交信息

```bash
git add -A
git commit -m "Phase 2 Complete: Audio Logic Integration

Integrated audio system with React:
- Created useAudioService Hook for state management
- Connected Start/Stop buttons to audio controls
- Connected instrument selection to synth switching
- Added real-time visualizer updates
- Full TypeScript type safety

Strategy: [Option A/Option B]
Status: All audio features working ✅

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```
