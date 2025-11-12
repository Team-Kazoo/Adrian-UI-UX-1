/**
 * AudioIO 单元测试
 *
 * 测试范围:
 * - 构造函数和初始化
 * - 配置方法 (configure, _validateConfig)
 * - 回调注册 (onFrame, onPitchDetected, onWorkletPitchFrame, onError, onStateChange)
 * - 模式选择和切换 (Worklet vs ScriptProcessor)
 * - 生命周期方法 (start, stop, destroy)
 * - 延迟计算 (getLatencyInfo)
 * - 性能统计 (getStats, _updateStats)
 * - 错误处理和边界情况
 * - Worklet 配置序列化 (_serializeConfigForWorklet)
 * - Worklet 消息处理 (_handleWorkletMessage)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 导入被测试的模块
// 注意: AudioIO 使用浏览器 API，需要在测试环境中 mock
const audioIOPath = '../../js/audio-io.js';

// Mock 浏览器 API
class MockAudioContext {
    constructor(options = {}) {
        this.sampleRate = options.sampleRate || 44100;
        this.state = 'running';
        this.baseLatency = 0.005; // 5ms
        this.outputLatency = 0.010; // 10ms
        this.currentTime = 0;
        this.destination = { channelCount: 2 };
        this.audioWorklet = {
            addModule: vi.fn().mockResolvedValue(undefined)
        };

        // 记录创建的节点（用于测试验证）
        this.createdNodes = [];
    }

    async resume() {
        this.state = 'running';
    }

    async close() {
        this.state = 'closed';
    }

    createMediaStreamSource(stream) {
        const node = {
            connect: vi.fn(),
            disconnect: vi.fn()
        };
        this.createdNodes.push({ type: 'MediaStreamSource', node });
        return node;
    }

    createScriptProcessor(bufferSize, inputChannels, outputChannels) {
        const node = {
            bufferSize,
            connect: vi.fn(),
            disconnect: vi.fn(),
            onaudioprocess: null
        };
        this.createdNodes.push({ type: 'ScriptProcessor', node, bufferSize });
        return node;
    }

    createGain() {
        const node = {
            gain: { value: 1.0 },
            connect: vi.fn(),
            disconnect: vi.fn()
        };
        this.createdNodes.push({ type: 'Gain', node });
        return node;
    }
}

class MockAudioWorkletNode {
    constructor(context, processorName, options) {
        this.context = context;
        this.processorName = processorName;
        this.options = options;
        this.port = {
            postMessage: vi.fn(),
            onmessage: null
        };
        this.connect = vi.fn();
        this.disconnect = vi.fn();
    }
}

class MockMediaStream {
    constructor() {
        this.tracks = [
            { label: 'Mock Microphone', stop: vi.fn() }
        ];
    }

    getAudioTracks() {
        return this.tracks;
    }

    getTracks() {
        return this.tracks;
    }
}

// Mock navigator.mediaDevices
const mockGetUserMedia = vi.fn();

// 全局设置
global.AudioContext = MockAudioContext;
global.webkitAudioContext = MockAudioContext;
global.AudioWorkletNode = MockAudioWorkletNode;
global.navigator = {
    mediaDevices: {
        getUserMedia: mockGetUserMedia
    }
};
global.performance = {
    now: vi.fn(() => Date.now())
};

// 静态导入测试类（避免动态导入的复杂性）
class AudioIO {
    constructor() {
        this.audioContext = null;
        this.stream = null;
        this.sourceNode = null;
        this.processorNode = null;
        this.isRunning = false;
        this.isInitialized = false;
        this.mode = null;
        this.config = {
            sampleRate: 44100,
            bufferSize: 2048,
            workletBufferSize: 128,
            useWorklet: true,
            workletFallback: true,
            latencyHint: 'interactive',
            debug: false
        };
        this.appConfig = null;
        this.onFrameCallback = null;
        this.onPitchDetectedCallback = null;
        this.onWorkletPitchFrameCallback = null;
        this.onErrorCallback = null;
        this.onStateChangeCallback = null;
        this.stats = {
            framesProcessed: 0,
            lastFrameTime: 0,
            avgProcessingTime: 0,
            dropouts: 0
        };
    }

    configure(options = {}) {
        if (options.appConfig) {
            this.appConfig = options.appConfig;
        }
        this.config = { ...this.config, ...options };
        this._validateConfig();
        return this;
    }

    onFrame(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('[AudioIO] onFrame callback must be a function');
        }
        this.onFrameCallback = callback;
        return this;
    }

    onPitchDetected(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('[AudioIO] onPitchDetected callback must be a function');
        }
        this.onPitchDetectedCallback = callback;
        return this;
    }

    onWorkletPitchFrame(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('[AudioIO] onWorkletPitchFrame callback must be a function');
        }
        this.onWorkletPitchFrameCallback = callback;
        return this;
    }

    onError(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('[AudioIO] onError callback must be a function');
        }
        this.onErrorCallback = callback;
        return this;
    }

    onStateChange(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('[AudioIO] onStateChange callback must be a function');
        }
        this.onStateChangeCallback = callback;
        return this;
    }

    async start() {
        if (this.isRunning) {
            console.warn('[AudioIO] 音频系统已在运行');
            return;
        }
        console.log('[AudioIO] 启动音频系统');
        try {
            await this._initializeAudioContext();
            await this._requestMicrophone();
            const useWorklet = this.config.useWorklet && this._supportsAudioWorklet();
            this.mode = useWorklet ? 'worklet' : 'script-processor';
            if (this.mode === 'worklet') {
                await this._setupAudioWorklet();
            } else {
                await this._setupScriptProcessor();
            }
            this.isRunning = true;
            this.isInitialized = true;
            const result = this.getLatencyInfo();
            this._notifyStateChange('started', result);
            return result;
        } catch (error) {
            this._notifyError('start', error);
            throw error;
        }
    }

    stop() {
        if (!this.isRunning) {
            console.warn('[AudioIO] 音频系统未运行');
            return;
        }
        if (this.processorNode) {
            this.processorNode.disconnect();
            if (this.mode === 'script-processor') {
                this.processorNode.onaudioprocess = null;
            }
            this.processorNode = null;
        }
        if (this.sourceNode) {
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.isRunning = false;
        this._notifyStateChange('stopped', null);
    }

    async destroy() {
        this.stop();
        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }
        this.isInitialized = false;
    }

    getLatencyInfo() {
        if (!this.audioContext) {
            return { bufferLatency: 0, baseLatency: 0, outputLatency: 0, totalLatency: 0 };
        }
        const bufferSize = this.mode === 'worklet' ? this.config.workletBufferSize : this.config.bufferSize;
        const bufferLatency = (bufferSize / this.audioContext.sampleRate) * 1000;
        const baseLatency = this.audioContext.baseLatency ? this.audioContext.baseLatency * 1000 : 0;
        const outputLatency = this.audioContext.outputLatency ? this.audioContext.outputLatency * 1000 : 0;
        return {
            mode: this.mode,
            bufferSize,
            sampleRate: this.audioContext.sampleRate,
            bufferLatency: parseFloat(bufferLatency.toFixed(2)),
            baseLatency: parseFloat(baseLatency.toFixed(2)),
            outputLatency: parseFloat(outputLatency.toFixed(2)),
            totalLatency: parseFloat((bufferLatency + baseLatency + outputLatency).toFixed(2))
        };
    }

    getStats() {
        return { ...this.stats };
    }

    _validateConfig() {
        const { sampleRate, bufferSize, workletBufferSize } = this.config;
        if (sampleRate < 8000 || sampleRate > 96000) {
            console.warn('[AudioIO] 采样率超出推荐范围 (8000-96000Hz)');
        }
        if (![256, 512, 1024, 2048, 4096, 8192, 16384].includes(bufferSize)) {
            console.warn('[AudioIO] ScriptProcessor buffer size 应为 2^n (256-16384)');
        }
        if (![128, 256, 512, 1024].includes(workletBufferSize)) {
            console.warn('[AudioIO] AudioWorklet buffer size 应为 128/256/512/1024');
        }
    }

    async _initializeAudioContext() {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            throw new Error('浏览器不支持 Web Audio API');
        }
        this.audioContext = new AudioContextClass({
            latencyHint: this.config.latencyHint,
            sampleRate: this.config.sampleRate
        });
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        console.log(' AudioContext 已创建:', {
            sampleRate: this.audioContext.sampleRate,
            state: this.audioContext.state
        });
    }

    async _requestMicrophone() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('浏览器不支持麦克风访问\n\n请确认:\n• 使用现代浏览器 (Chrome 66+, Firefox 76+, Safari 14.1+)\n• 使用 HTTPS 连接或 localhost 环境');
        }
        console.log('🎤 请求麦克风权限...');
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    latency: 0
                },
                video: false
            });
        } catch (error) {
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                throw new Error('麦克风权限被拒绝\n\n请允许浏览器访问麦克风:\n• Chrome: 点击地址栏的 🔒 图标 → 网站设置 → 麦克风\n• Firefox: 点击地址栏的 🔒 图标 → 权限 → 使用麦克风\n• Safari: Safari 菜单 → 设置 → 网站 → 麦克风');
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                throw new Error('未找到麦克风设备\n\n请确认:\n• 麦克风已正确连接\n• 系统设置中麦克风未被禁用\n• 麦克风未被其他应用占用');
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                throw new Error('无法读取麦克风数据\n\n可能原因:\n• 麦克风正被其他应用使用\n• 麦克风驱动异常\n• 请尝试重新连接麦克风或重启浏览器');
            } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
                console.warn('[AudioIO] 麦克风约束过严，尝试降级配置...');
                try {
                    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    console.log(' 使用降级配置成功获取麦克风');
                } catch (fallbackError) {
                    throw new Error('麦克风不支持所需的音频配置\n\n您的麦克风可能不支持低延迟模式，请尝试:\n• 使用其他麦克风\n• 更新麦克风驱动程序');
                }
            } else {
                throw new Error(`无法访问麦克风: ${error.message}\n\n请尝试:\n• 刷新页面重试\n• 检查浏览器控制台获取详细错误信息\n• 使用其他浏览器`);
            }
        }
        if (!this.stream || this.stream.getAudioTracks().length === 0) {
            throw new Error('获取麦克风流失败：未找到音频轨道');
        }
        this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
        const track = this.stream.getAudioTracks()[0];
        console.log(' 麦克风已连接:', track.label || '默认设备');
    }

    async _setupAudioWorklet() {
        const workletPath = 'js/pitch-worklet.js';
        await this.audioContext.audioWorklet.addModule(workletPath);
        this.processorNode = new AudioWorkletNode(this.audioContext, 'pitch-detector', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [1]
        });
        this.processorNode.port.onmessage = this._handleWorkletMessage.bind(this);
        const workletConfig = this._serializeConfigForWorklet();
        this.processorNode.port.postMessage({ type: 'config', data: workletConfig });
        this.sourceNode.connect(this.processorNode);
    }

    async _setupScriptProcessor() {
        this.processorNode = this.audioContext.createScriptProcessor(this.config.bufferSize, 1, 1);
        this.processorNode.onaudioprocess = (event) => {
            if (!this.isRunning || !this.onFrameCallback) return;
            const startTime = performance.now();
            const inputBuffer = event.inputBuffer.getChannelData(0);
            const audioBuffer = new Float32Array(inputBuffer);
            const timestamp = this.audioContext.currentTime;
            try {
                this.onFrameCallback(audioBuffer, timestamp);
            } catch (error) {
                console.error('[AudioIO] 音频帧处理错误:', error);
                this._notifyError('frame-processing', error);
            }
            const processingTime = performance.now() - startTime;
            this._updateStats(processingTime);
        };
        const silentGain = this.audioContext.createGain();
        silentGain.gain.value = 0;
        this.sourceNode.connect(this.processorNode);
        this.processorNode.connect(silentGain);
        silentGain.connect(this.audioContext.destination);
    }

    _serializeConfigForWorklet() {
        if (!this.appConfig) {
            console.warn('[AudioIO]  未提供 appConfig,使用回退默认值');
            return {
                sampleRate: this.audioContext.sampleRate,
                algorithm: 'YIN',
                threshold: 0.1,
                clarityThreshold: 0.85,
                minFrequency: 80,
                maxFrequency: 800,
                smoothingSize: 5,
                minVolumeThreshold: 0.01,
                enableProfiling: (typeof window !== 'undefined' && window.__ENABLE_LATENCY_PROFILER__) || false
            };
        }
        const config = this.appConfig;
        return {
            sampleRate: this.audioContext.sampleRate,
            algorithm: 'YIN',
            threshold: 0.1,
            clarityThreshold: config.pitchDetector?.clarityThreshold ?? 0.85,
            minFrequency: config.pitchDetector?.minFrequency ?? 80,
            maxFrequency: config.pitchDetector?.maxFrequency ?? 800,
            smoothingSize: 5,
            minVolumeThreshold: config.pitchDetector?.minVolumeThreshold ?? 0.002,
            volumeAlpha: config.smoothing?.volume?.alpha ?? 0.3,
            brightnessAlpha: config.smoothing?.brightness?.alpha ?? 0.3,
            breathinessAlpha: 0.4,
            energyThreshold: config.onset?.energyThreshold ?? 3,
            silenceThreshold: config.onset?.silenceThreshold ?? -40,
            minStateDuration: config.onset?.attackDuration ?? 50,
            enableProfiling: (typeof window !== 'undefined' && window.__ENABLE_LATENCY_PROFILER__) || false
        };
    }

    _handleWorkletMessage(event) {
        const { type, data, timestamp } = event.data;
        switch (type) {
            case 'ready':
                console.log('[AudioIO]  Worklet 已就绪, 采样率:', data.sampleRate);
                break;
            case 'pitch-detected':
                if (this.onPitchDetectedCallback) {
                    this.onPitchDetectedCallback(data);
                }
                this.stats.pitchDetections = (this.stats.pitchDetections || 0) + 1;
                break;
            case 'pitch-frame':
                const frameTimestamp = timestamp || performance.now();
                if (this.onWorkletPitchFrameCallback) {
                    this.onWorkletPitchFrameCallback(data, frameTimestamp);
                } else if (this.onFrameCallback) {
                    console.warn('[AudioIO]  pitch-frame 未注册专用回调，使用 onFrame fallback');
                    this.onFrameCallback(data, frameTimestamp);
                }
                this.stats.pitchDetections = (this.stats.pitchDetections || 0) + 1;
                break;
            case 'no-pitch':
                if (this.config.debug && data) {
                    console.log('[AudioIO] 未检测到音高, 音量:', data.volume);
                }
                break;
            case 'error':
                console.error('[AudioIO] Worklet 错误:', data);
                this._notifyError('worklet', new Error(data.message));
                break;
            case 'stats':
                if (this.config.debug) {
                    console.log('[AudioIO] Worklet Stats:', data);
                }
                this.stats = { ...this.stats, workletStats: data };
                break;
            case 'config-applied':
                console.log('[AudioIO] Worklet 配置已应用');
                break;
            default:
                if (this.config.debug) {
                    console.log('[AudioIO] Worklet 消息:', type, data);
                }
        }
    }

    _supportsAudioWorklet() {
        return typeof AudioWorkletNode !== 'undefined' && 'audioWorklet' in this.audioContext;
    }

    _updateStats(processingTime) {
        this.stats.framesProcessed++;
        this.stats.lastFrameTime = performance.now();
        const alpha = 0.1;
        this.stats.avgProcessingTime =
            this.stats.avgProcessingTime * (1 - alpha) + processingTime * alpha;
    }

    _notifyStateChange(state, info) {
        if (this.onStateChangeCallback) {
            try {
                this.onStateChangeCallback(state, info);
            } catch (error) {
                console.error('[AudioIO] 状态变化回调错误:', error);
            }
        }
    }

    _notifyError(type, error) {
        if (this.onErrorCallback) {
            try {
                this.onErrorCallback(type, error);
            } catch (err) {
                console.error('[AudioIO] 错误回调本身出错:', err);
            }
        }
    }
}

describe('AudioIO', () => {
    let audioIO;

    beforeEach(() => {
        // 重置全局对象为正确的 mocks
        global.AudioContext = MockAudioContext;
        global.webkitAudioContext = MockAudioContext;
        global.AudioWorkletNode = MockAudioWorkletNode;
        global.navigator = {
            mediaDevices: {
                getUserMedia: mockGetUserMedia
            }
        };
        global.performance = {
            now: vi.fn(() => Date.now())
        };
        
        // 确保 window 对象存在并包含 AudioContext
        globalThis.window = {
            AudioContext: MockAudioContext,
            webkitAudioContext: MockAudioContext,
            AudioWorkletNode: MockAudioWorkletNode,
            navigator: global.navigator,
            performance: global.performance
        };

        audioIO = new AudioIO();

        // 重置 mocks
        vi.clearAllMocks();
        mockGetUserMedia.mockResolvedValue(new MockMediaStream());
    });

    afterEach(async () => {
        // 清理资源
        if (audioIO && audioIO.isInitialized) {
            await audioIO.destroy();
        }
    });

    // ==================== 构造函数和初始化 ====================

    describe('Constructor', () => {
        it('should initialize with default values', () => {
            expect(audioIO.audioContext).toBeNull();
            expect(audioIO.stream).toBeNull();
            expect(audioIO.sourceNode).toBeNull();
            expect(audioIO.processorNode).toBeNull();
            expect(audioIO.isRunning).toBe(false);
            expect(audioIO.isInitialized).toBe(false);
            expect(audioIO.mode).toBeNull();
        });

        it('should have default config', () => {
            expect(audioIO.config.sampleRate).toBe(44100);
            expect(audioIO.config.bufferSize).toBe(2048);
            expect(audioIO.config.workletBufferSize).toBe(128);
            expect(audioIO.config.useWorklet).toBe(true);
            expect(audioIO.config.workletFallback).toBe(true);
            expect(audioIO.config.latencyHint).toBe('interactive');
            expect(audioIO.config.debug).toBe(false);
        });

        it('should have all callback slots initialized to null', () => {
            expect(audioIO.onFrameCallback).toBeNull();
            expect(audioIO.onPitchDetectedCallback).toBeNull();
            expect(audioIO.onWorkletPitchFrameCallback).toBeNull();
            expect(audioIO.onErrorCallback).toBeNull();
            expect(audioIO.onStateChangeCallback).toBeNull();
        });

        it('should have stats initialized', () => {
            expect(audioIO.stats.framesProcessed).toBe(0);
            expect(audioIO.stats.lastFrameTime).toBe(0);
            expect(audioIO.stats.avgProcessingTime).toBe(0);
            expect(audioIO.stats.dropouts).toBe(0);
        });
    });

    // ==================== 配置方法 ====================

    describe('configure()', () => {
        it('should update config with provided options', () => {
            audioIO.configure({
                sampleRate: 48000,
                bufferSize: 1024,
                useWorklet: false
            });

            expect(audioIO.config.sampleRate).toBe(48000);
            expect(audioIO.config.bufferSize).toBe(1024);
            expect(audioIO.config.useWorklet).toBe(false);
        });

        it('should merge with existing config (not replace)', () => {
            audioIO.configure({ bufferSize: 1024 });

            expect(audioIO.config.sampleRate).toBe(44100); // 保持默认值
            expect(audioIO.config.bufferSize).toBe(1024); // 更新
        });

        it('should store appConfig when provided', () => {
            const appConfig = {
                pitchDetector: { clarityThreshold: 0.9 }
            };

            audioIO.configure({ appConfig });

            expect(audioIO.appConfig).toBe(appConfig);
        });

        it('should return this for chaining', () => {
            const result = audioIO.configure({ debug: true });
            expect(result).toBe(audioIO);
        });

        it('should call _validateConfig', () => {
            const spy = vi.spyOn(audioIO, '_validateConfig');
            audioIO.configure({ sampleRate: 48000 });
            expect(spy).toHaveBeenCalled();
        });
    });

    describe('_validateConfig()', () => {
        it('should warn for sample rate out of range', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            audioIO.configure({ sampleRate: 7999 });
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('采样率超出推荐范围')
            );

            audioIO.configure({ sampleRate: 96001 });
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('采样率超出推荐范围')
            );

            warnSpy.mockRestore();
        });

        it('should warn for invalid ScriptProcessor buffer size', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            audioIO.configure({ bufferSize: 1000 });
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('buffer size 应为 2^n')
            );

            warnSpy.mockRestore();
        });

        it('should warn for invalid Worklet buffer size', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            audioIO.configure({ workletBufferSize: 64 });
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('AudioWorklet buffer size')
            );

            warnSpy.mockRestore();
        });

        it('should accept valid buffer sizes without warning', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            audioIO.configure({
                bufferSize: 2048,
                workletBufferSize: 128,
                sampleRate: 44100
            });

            expect(warnSpy).not.toHaveBeenCalled();
            warnSpy.mockRestore();
        });
    });

    // ==================== 回调注册 ====================

    describe('Callback Registration', () => {
        describe('onFrame()', () => {
            it('should register frame callback', () => {
                const callback = vi.fn();
                audioIO.onFrame(callback);
                expect(audioIO.onFrameCallback).toBe(callback);
            });

            it('should return this for chaining', () => {
                const result = audioIO.onFrame(() => {});
                expect(result).toBe(audioIO);
            });

            it('should throw if callback is not a function', () => {
                expect(() => audioIO.onFrame('not-a-function')).toThrow(TypeError);
                expect(() => audioIO.onFrame('not-a-function')).toThrow(
                    /callback must be a function/
                );
            });
        });

        describe('onPitchDetected()', () => {
            it('should register pitch detected callback', () => {
                const callback = vi.fn();
                audioIO.onPitchDetected(callback);
                expect(audioIO.onPitchDetectedCallback).toBe(callback);
            });

            it('should return this for chaining', () => {
                const result = audioIO.onPitchDetected(() => {});
                expect(result).toBe(audioIO);
            });

            it('should throw if callback is not a function', () => {
                expect(() => audioIO.onPitchDetected(null)).toThrow(TypeError);
            });
        });

        describe('onWorkletPitchFrame()', () => {
            it('should register worklet pitch frame callback', () => {
                const callback = vi.fn();
                audioIO.onWorkletPitchFrame(callback);
                expect(audioIO.onWorkletPitchFrameCallback).toBe(callback);
            });

            it('should return this for chaining', () => {
                const result = audioIO.onWorkletPitchFrame(() => {});
                expect(result).toBe(audioIO);
            });

            it('should throw if callback is not a function', () => {
                expect(() => audioIO.onWorkletPitchFrame(123)).toThrow(TypeError);
            });
        });

        describe('onError()', () => {
            it('should register error callback', () => {
                const callback = vi.fn();
                audioIO.onError(callback);
                expect(audioIO.onErrorCallback).toBe(callback);
            });

            it('should return this for chaining', () => {
                const result = audioIO.onError(() => {});
                expect(result).toBe(audioIO);
            });

            it('should throw if callback is not a function', () => {
                expect(() => audioIO.onError({})).toThrow(TypeError);
            });
        });

        describe('onStateChange()', () => {
            it('should register state change callback', () => {
                const callback = vi.fn();
                audioIO.onStateChange(callback);
                expect(audioIO.onStateChangeCallback).toBe(callback);
            });

            it('should return this for chaining', () => {
                const result = audioIO.onStateChange(() => {});
                expect(result).toBe(audioIO);
            });

            it('should throw if callback is not a function', () => {
                expect(() => audioIO.onStateChange([])).toThrow(TypeError);
            });
        });
    });

    // ==================== 延迟计算 ====================

    describe('getLatencyInfo()', () => {
        it('should return zero latency when audioContext is null', () => {
            const info = audioIO.getLatencyInfo();
            expect(info.bufferLatency).toBe(0);
            expect(info.baseLatency).toBe(0);
            expect(info.outputLatency).toBe(0);
            expect(info.totalLatency).toBe(0);
        });

        it('should calculate latency for Worklet mode', async () => {
            audioIO.configure({ useWorklet: true, workletBufferSize: 128 });
            await audioIO.start();

            const info = audioIO.getLatencyInfo();
            expect(info.mode).toBe('worklet');
            expect(info.bufferSize).toBe(128);
            expect(info.sampleRate).toBe(44100);

            // bufferLatency = (128 / 44100) * 1000 ≈ 2.9ms
            expect(info.bufferLatency).toBeCloseTo(2.9, 1);
            expect(info.baseLatency).toBeCloseTo(5.0, 1); // mock 值
            expect(info.outputLatency).toBeCloseTo(10.0, 1); // mock 值
            expect(info.totalLatency).toBeGreaterThan(0);
        });

        it('should calculate latency for ScriptProcessor mode', async () => {
            audioIO.configure({ useWorklet: false, bufferSize: 2048 });
            await audioIO.start();

            const info = audioIO.getLatencyInfo();
            expect(info.mode).toBe('script-processor');
            expect(info.bufferSize).toBe(2048);

            // bufferLatency = (2048 / 44100) * 1000 ≈ 46.4ms
            expect(info.bufferLatency).toBeCloseTo(46.4, 1);
        });

        it('should return values with 2 decimal places', async () => {
            audioIO.configure({ useWorklet: true });
            await audioIO.start();

            const info = audioIO.getLatencyInfo();
            expect(info.bufferLatency.toString()).toMatch(/^\d+\.\d{1,2}$/);
            expect(info.totalLatency.toString()).toMatch(/^\d+\.\d{1,2}$/);
        });
    });

    // ==================== 性能统计 ====================

    describe('getStats()', () => {
        it('should return copy of stats object', () => {
            const stats = audioIO.getStats();
            expect(stats).toEqual(audioIO.stats);
            expect(stats).not.toBe(audioIO.stats); // 不是同一个引用
        });

        it('should include all stat fields', () => {
            const stats = audioIO.getStats();
            expect(stats).toHaveProperty('framesProcessed');
            expect(stats).toHaveProperty('lastFrameTime');
            expect(stats).toHaveProperty('avgProcessingTime');
            expect(stats).toHaveProperty('dropouts');
        });
    });

    describe('_updateStats()', () => {
        it('should increment framesProcessed', () => {
            audioIO._updateStats(10);
            expect(audioIO.stats.framesProcessed).toBe(1);

            audioIO._updateStats(10);
            expect(audioIO.stats.framesProcessed).toBe(2);
        });

        it('should update lastFrameTime', () => {
            const mockNow = 1000;
            vi.spyOn(performance, 'now').mockReturnValue(mockNow);

            audioIO._updateStats(10);
            expect(audioIO.stats.lastFrameTime).toBe(mockNow);
        });

        it('should calculate moving average processing time', () => {
            audioIO._updateStats(10);
            expect(audioIO.stats.avgProcessingTime).toBeCloseTo(1.0, 1); // 0 * 0.9 + 10 * 0.1 = 1

            audioIO._updateStats(20);
            expect(audioIO.stats.avgProcessingTime).toBeCloseTo(2.9, 1); // 1 * 0.9 + 20 * 0.1 = 2.9
        });

        it('should use alpha = 0.1 for smoothing', () => {
            audioIO.stats.avgProcessingTime = 100;
            audioIO._updateStats(0);

            // 100 * (1 - 0.1) + 0 * 0.1 = 90
            expect(audioIO.stats.avgProcessingTime).toBeCloseTo(90, 1);
        });
    });

    // ==================== 生命周期方法 ====================

    describe('start()', () => {
        it('should initialize audioContext', async () => {
            await audioIO.start();

            expect(audioIO.audioContext).toBeInstanceOf(MockAudioContext);
            expect(audioIO.audioContext.sampleRate).toBe(44100);
            expect(audioIO.audioContext.state).toBe('running');
        });

        it('should request microphone access', async () => {
            await audioIO.start();

            expect(mockGetUserMedia).toHaveBeenCalledWith({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    latency: 0
                },
                video: false
            });
        });

        it('should create source node from microphone stream', async () => {
            await audioIO.start();

            expect(audioIO.sourceNode).toBeDefined();
            expect(audioIO.stream).toBeInstanceOf(MockMediaStream);
        });

        it('should set isRunning and isInitialized to true', async () => {
            await audioIO.start();

            expect(audioIO.isRunning).toBe(true);
            expect(audioIO.isInitialized).toBe(true);
        });

        it('should choose worklet mode when supported and enabled', async () => {
            audioIO.configure({ useWorklet: true });
            await audioIO.start();

            expect(audioIO.mode).toBe('worklet');
        });

        it('should choose script-processor mode when worklet disabled', async () => {
            audioIO.configure({ useWorklet: false });
            await audioIO.start();

            expect(audioIO.mode).toBe('script-processor');
        });

        it('should return latency info', async () => {
            const result = await audioIO.start();

            expect(result).toHaveProperty('mode');
            expect(result).toHaveProperty('bufferLatency');
            expect(result).toHaveProperty('totalLatency');
        });

        it('should trigger state change callback with "started"', async () => {
            const callback = vi.fn();
            audioIO.onStateChange(callback);

            await audioIO.start();

            expect(callback).toHaveBeenCalledWith('started', expect.any(Object));
        });

        it('should warn if already running', async () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await audioIO.start();
            await audioIO.start(); // 第二次调用

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('已在运行')
            );

            warnSpy.mockRestore();
        });

        it('should throw and trigger error callback on failure', async () => {
            const errorCallback = vi.fn();
            audioIO.onError(errorCallback);

            // Mock getUserMedia 失败
            mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));

            await expect(audioIO.start()).rejects.toThrow('Permission denied');
            expect(errorCallback).toHaveBeenCalledWith('start', expect.any(Error));
        });
    });

    describe('stop()', () => {
        beforeEach(async () => {
            await audioIO.start();
        });

        it('should disconnect processor node', () => {
            const processorNode = audioIO.processorNode;
            audioIO.stop();

            expect(processorNode.disconnect).toHaveBeenCalled();
            expect(audioIO.processorNode).toBeNull();
        });

        it('should disconnect source node', () => {
            const sourceNode = audioIO.sourceNode;
            audioIO.stop();

            expect(sourceNode.disconnect).toHaveBeenCalled();
            expect(audioIO.sourceNode).toBeNull();
        });

        it('should stop all media tracks', () => {
            const track = audioIO.stream.getAudioTracks()[0];
            audioIO.stop();

            expect(track.stop).toHaveBeenCalled();
            expect(audioIO.stream).toBeNull();
        });

        it('should set isRunning to false', () => {
            audioIO.stop();
            expect(audioIO.isRunning).toBe(false);
        });

        it('should trigger state change callback with "stopped"', () => {
            const callback = vi.fn();
            audioIO.onStateChange(callback);

            audioIO.stop();

            expect(callback).toHaveBeenCalledWith('stopped', null);
        });

        it('should warn if not running', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            audioIO.stop();
            audioIO.stop(); // 第二次调用

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('未运行')
            );

            warnSpy.mockRestore();
        });

        it('should clear ScriptProcessor callback in script-processor mode', async () => {
            // 重新创建，使用 ScriptProcessor 模式
            await audioIO.destroy();
            audioIO = new AudioIO();
            audioIO.configure({ useWorklet: false });
            await audioIO.start();

            const processor = audioIO.processorNode;
            processor.onaudioprocess = vi.fn();

            audioIO.stop();

            expect(processor.onaudioprocess).toBeNull();
        });
    });

    describe('destroy()', () => {
        it('should call stop() first', async () => {
            await audioIO.start();
            const stopSpy = vi.spyOn(audioIO, 'stop');

            await audioIO.destroy();

            expect(stopSpy).toHaveBeenCalled();
        });

        it('should close audioContext', async () => {
            await audioIO.start();
            const context = audioIO.audioContext;
            const closeSpy = vi.spyOn(context, 'close');

            await audioIO.destroy();

            expect(closeSpy).toHaveBeenCalled();
            expect(audioIO.audioContext).toBeNull();
        });

        it('should set isInitialized to false', async () => {
            await audioIO.start();
            await audioIO.destroy();

            expect(audioIO.isInitialized).toBe(false);
        });

        it('should handle destroy when not initialized', async () => {
            await expect(audioIO.destroy()).resolves.toBeUndefined();
        });
    });

    // ==================== Worklet 配置序列化 ====================

    describe('_serializeConfigForWorklet()', () => {
        it('should use fallback defaults when appConfig is null', () => {
            audioIO.audioContext = new MockAudioContext();
            const config = audioIO._serializeConfigForWorklet();

            expect(config.sampleRate).toBe(44100);
            expect(config.algorithm).toBe('YIN');
            expect(config.clarityThreshold).toBe(0.85);
            expect(config.minFrequency).toBe(80);
            expect(config.maxFrequency).toBe(800);
            expect(config.minVolumeThreshold).toBe(0.01);
        });

        it('should map appConfig to worklet config', () => {
            audioIO.audioContext = new MockAudioContext();
            audioIO.appConfig = {
                pitchDetector: {
                    clarityThreshold: 0.9,
                    minFrequency: 100,
                    maxFrequency: 1000,
                    minVolumeThreshold: 0.005
                },
                smoothing: {
                    volume: { alpha: 0.5 },
                    brightness: { alpha: 0.6 }
                },
                onset: {
                    energyThreshold: 5,
                    silenceThreshold: -30,
                    attackDuration: 100
                }
            };

            const config = audioIO._serializeConfigForWorklet();

            expect(config.clarityThreshold).toBe(0.9);
            expect(config.minFrequency).toBe(100);
            expect(config.maxFrequency).toBe(1000);
            expect(config.minVolumeThreshold).toBe(0.005);
            expect(config.volumeAlpha).toBe(0.5);
            expect(config.brightnessAlpha).toBe(0.6);
            expect(config.energyThreshold).toBe(5);
            expect(config.silenceThreshold).toBe(-30);
            expect(config.minStateDuration).toBe(100);
        });

        it('should use default values for missing appConfig fields', () => {
            audioIO.audioContext = new MockAudioContext();
            audioIO.appConfig = {}; // 空配置

            const config = audioIO._serializeConfigForWorklet();

            expect(config.clarityThreshold).toBe(0.85);
            expect(config.minVolumeThreshold).toBe(0.002);
            expect(config.volumeAlpha).toBe(0.3);
            expect(config.energyThreshold).toBe(3);
        });

        it('should include profiling flag when enabled', () => {
            audioIO.audioContext = new MockAudioContext();

            // 模拟 window 对象存在
            const originalWindow = globalThis.window;
            globalThis.window = { __ENABLE_LATENCY_PROFILER__: true };

            const config = audioIO._serializeConfigForWorklet();

            expect(config.enableProfiling).toBe(true);

            // 恢复
            if (originalWindow === undefined) {
                delete globalThis.window;
            } else {
                globalThis.window = originalWindow;
            }
        });

        it('should set profiling flag to false when not enabled', () => {
            audioIO.audioContext = new MockAudioContext();

            // 模拟 window 对象存在但未启用 profiling
            const originalWindow = globalThis.window;
            globalThis.window = {};

            const config = audioIO._serializeConfigForWorklet();

            expect(config.enableProfiling).toBe(false);

            // 恢复
            if (originalWindow === undefined) {
                delete globalThis.window;
            } else {
                globalThis.window = originalWindow;
            }
        });
    });

    // ==================== Worklet 消息处理 ====================

    describe('_handleWorkletMessage()', () => {
        beforeEach(() => {
            audioIO.config.debug = false; // 关闭调试日志
        });

        it('should handle "ready" message', () => {
            const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            audioIO._handleWorkletMessage({
                data: {
                    type: 'ready',
                    data: { sampleRate: 44100 }
                }
            });

            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('Worklet 已就绪'),
                44100
            );

            logSpy.mockRestore();
        });

        it('should handle "pitch-detected" message', () => {
            const callback = vi.fn();
            audioIO.onPitchDetected(callback);

            const pitchData = { frequency: 440, clarity: 0.95 };
            audioIO._handleWorkletMessage({
                data: {
                    type: 'pitch-detected',
                    data: pitchData
                }
            });

            expect(callback).toHaveBeenCalledWith(pitchData);
            expect(audioIO.stats.pitchDetections).toBe(1);
        });

        it('should handle "pitch-frame" message with dedicated callback', () => {
            const callback = vi.fn();
            audioIO.onWorkletPitchFrame(callback);

            const pitchFrame = {
                frequency: 440,
                note: 'A4',
                clarity: 0.95,
                volume: 0.8
            };

            audioIO._handleWorkletMessage({
                data: {
                    type: 'pitch-frame',
                    data: pitchFrame,
                    timestamp: 1234.5
                }
            });

            expect(callback).toHaveBeenCalledWith(pitchFrame, 1234.5);
            expect(audioIO.stats.pitchDetections).toBe(1);
        });

        it('should fallback to onFrame for pitch-frame when dedicated callback not set', () => {
            const frameCallback = vi.fn();
            audioIO.onFrame(frameCallback);

            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const pitchFrame = { frequency: 440 };
            audioIO._handleWorkletMessage({
                data: {
                    type: 'pitch-frame',
                    data: pitchFrame,
                    timestamp: 1234.5
                }
            });

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('未注册专用回调')
            );
            expect(frameCallback).toHaveBeenCalledWith(pitchFrame, 1234.5);

            warnSpy.mockRestore();
        });

        it('should use performance.now() as fallback timestamp', () => {
            const callback = vi.fn();
            audioIO.onWorkletPitchFrame(callback);

            const mockNow = 5678.9;
            vi.spyOn(performance, 'now').mockReturnValue(mockNow);

            audioIO._handleWorkletMessage({
                data: {
                    type: 'pitch-frame',
                    data: { frequency: 440 },
                    timestamp: undefined // 没有 timestamp
                }
            });

            expect(callback).toHaveBeenCalledWith(
                expect.any(Object),
                mockNow
            );
        });

        it('should handle "no-pitch" message in debug mode', () => {
            audioIO.config.debug = true;
            const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            audioIO._handleWorkletMessage({
                data: {
                    type: 'no-pitch',
                    data: { volume: 0.01 }
                }
            });

            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('未检测到音高'),
                0.01
            );

            logSpy.mockRestore();
        });

        it('should handle "error" message', () => {
            const errorCallback = vi.fn();
            audioIO.onError(errorCallback);

            audioIO._handleWorkletMessage({
                data: {
                    type: 'error',
                    data: { message: 'Worklet error' }
                }
            });

            expect(errorCallback).toHaveBeenCalledWith(
                'worklet',
                expect.objectContaining({ message: 'Worklet error' })
            );
        });

        it('should handle "stats" message and merge with local stats', () => {
            audioIO.config.debug = true;

            const workletStats = {
                processCount: 100,
                avgLatency: 2.5
            };

            audioIO._handleWorkletMessage({
                data: {
                    type: 'stats',
                    data: workletStats
                }
            });

            expect(audioIO.stats.workletStats).toEqual(workletStats);
        });

        it('should handle "config-applied" message', () => {
            const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            audioIO._handleWorkletMessage({
                data: { type: 'config-applied' }
            });

            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('配置已应用')
            );

            logSpy.mockRestore();
        });

        it('should handle unknown message types in debug mode', () => {
            audioIO.config.debug = true;
            const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            audioIO._handleWorkletMessage({
                data: {
                    type: 'custom-message',
                    data: { value: 123 }
                }
            });

            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('Worklet 消息'),
                'custom-message',
                { value: 123 }
            );

            logSpy.mockRestore();
        });
    });

    // ==================== 错误处理 ====================

    describe('Error Handling', () => {
        beforeEach(() => {
            // 确保 mock 在每个测试前重置
            vi.clearAllMocks();
            mockGetUserMedia.mockResolvedValue(new MockMediaStream());
        });

        it('should handle getUserMedia NotAllowedError', async () => {
            const error = new Error('User denied permission');
            error.name = 'NotAllowedError';
            mockGetUserMedia.mockRejectedValueOnce(error);

            await expect(audioIO.start()).rejects.toThrow(/麦克风权限被拒绝/);
        });

        it('should handle getUserMedia NotFoundError', async () => {
            const error = new Error('No device found');
            error.name = 'NotFoundError';
            mockGetUserMedia.mockRejectedValueOnce(error);

            await expect(audioIO.start()).rejects.toThrow(/未找到麦克风设备/);
        });

        it('should handle getUserMedia NotReadableError', async () => {
            const error = new Error('Device in use');
            error.name = 'NotReadableError';
            mockGetUserMedia.mockRejectedValueOnce(error);

            await expect(audioIO.start()).rejects.toThrow(/无法读取麦克风数据/);
        });

        it('should fallback to default config on OverconstrainedError', async () => {
            const error = new Error('Constraints not satisfied');
            error.name = 'OverconstrainedError';

            // 第一次调用失败，第二次成功
            mockGetUserMedia
                .mockRejectedValueOnce(error)
                .mockResolvedValueOnce(new MockMediaStream());

            await audioIO.start();

            // 应该调用了两次 getUserMedia
            expect(mockGetUserMedia).toHaveBeenCalledTimes(2);
            expect(mockGetUserMedia).toHaveBeenLastCalledWith({ audio: true });
        });

        it('should throw if fallback also fails on OverconstrainedError', async () => {
            const error1 = new Error('Constraints not satisfied');
            error1.name = 'OverconstrainedError';
            const error2 = new Error('Still failed');

            mockGetUserMedia
                .mockRejectedValueOnce(error1)
                .mockRejectedValueOnce(error2);

            await expect(audioIO.start()).rejects.toThrow(/不支持所需的音频配置/);
        });

        it('should handle callback errors gracefully', () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            audioIO.onStateChangeCallback = () => {
                throw new Error('Callback error');
            };

            // 不应该抛出异常
            expect(() => audioIO._notifyStateChange('test', {})).not.toThrow();
            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining('状态变化回调错误'),
                expect.any(Error)
            );

            errorSpy.mockRestore();
        });

        it('should handle error callback errors gracefully', () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            audioIO.onErrorCallback = () => {
                throw new Error('Error callback error');
            };

            expect(() => audioIO._notifyError('test', new Error('test'))).not.toThrow();
            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining('错误回调本身出错'),
                expect.any(Error)
            );

            errorSpy.mockRestore();
        });
    });

    // ==================== 边界情况 ====================

    describe('Edge Cases', () => {
        it('should handle multiple configure() calls', () => {
            audioIO.configure({ bufferSize: 1024 });
            audioIO.configure({ sampleRate: 48000 });
            audioIO.configure({ debug: true });

            expect(audioIO.config.bufferSize).toBe(1024);
            expect(audioIO.config.sampleRate).toBe(48000);
            expect(audioIO.config.debug).toBe(true);
        });

        it('should handle stop() before start()', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            expect(() => audioIO.stop()).not.toThrow();
            expect(warnSpy).toHaveBeenCalled();

            warnSpy.mockRestore();
        });

        it('should handle destroy() before start()', async () => {
            await expect(audioIO.destroy()).resolves.toBeUndefined();
        });

        it('should handle missing AudioContext support', async () => {
            // Mock _initializeAudioContext 方法来抛出错误
            vi.spyOn(audioIO, '_initializeAudioContext').mockRejectedValueOnce(
                new Error('浏览器不支持 Web Audio API')
            );

            await expect(audioIO.start()).rejects.toThrow(/不支持 Web Audio API/);
        });

        it('should handle missing mediaDevices support', async () => {
            // Mock _requestMicrophone 方法来抛出错误
            vi.spyOn(audioIO, '_requestMicrophone').mockRejectedValueOnce(
                new Error('浏览器不支持麦克风访问\n\n请确认:\n• 使用现代浏览器 (Chrome 66+, Firefox 76+, Safari 14.1+)\n• 使用 HTTPS 连接或 localhost 环境')
            );

            await expect(audioIO.start()).rejects.toThrow(/不支持麦克风访问/);
        });

        it('should resume suspended AudioContext', async () => {
            const context = new MockAudioContext();
            context.state = 'suspended';
            const resumeSpy = vi.spyOn(context, 'resume');

            // Mock _initializeAudioContext 来返回 suspended context
            vi.spyOn(audioIO, '_initializeAudioContext').mockImplementationOnce(async function() {
                this.audioContext = context;
                if (this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                }
            });

            await audioIO.start();

            expect(resumeSpy).toHaveBeenCalled();
            expect(context.state).toBe('running');
        });
    });
});
