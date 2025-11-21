import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioLoopController } from '../../js/core/audio-loop-controller.js';

// Mock dependencies
const mockActiveEngine = {
    processPitchFrame: vi.fn(),
    processPitch: vi.fn()
};

const mockSynthManager = {
    getActiveEngine: vi.fn().mockReturnValue(mockActiveEngine)
};

const mockVisualizerManager = {
    update: vi.fn()
};

const mockPerformanceMonitor = {
    startProcessing: vi.fn(),
    endProcessing: vi.fn(),
    updateFPS: vi.fn(),
    getMetrics: vi.fn().mockReturnValue({ totalLatency: 15.5, fps: 58 })
};

const mockPitchDetector = {
    detect: vi.fn()
};

const mockExpressiveFeatures = {
    process: vi.fn()
};

const mockAiHarmonizer = {
    enabled: false,
    processFrame: vi.fn()
};

// Mock util
vi.mock('../../js/utils/audio-utils.js', () => ({
    calculateRMS: vi.fn().mockReturnValue(0.5)
}));

describe('AudioLoopController', () => {
    let controller;

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Reset AiHarmonizer state
        mockAiHarmonizer.enabled = false;

        // Default behavior: pass through pitchInfo
        mockExpressiveFeatures.process.mockImplementation(({ pitchInfo }) => pitchInfo);

        controller = new AudioLoopController({
            synthManager: mockSynthManager,
            visualizerManager: mockVisualizerManager,
            performanceMonitor: mockPerformanceMonitor,
            pitchDetector: mockPitchDetector,
            expressiveFeatures: mockExpressiveFeatures,
            aiHarmonizer: mockAiHarmonizer
        });
    });

    describe('Initialization', () => {
        it('should initialize in stopped state', () => {
            expect(controller.isRunning).toBe(false);
            expect(controller.latencyMeasurements).toEqual([]);
        });

        it('should reset latency measurements on start', () => {
            controller.latencyMeasurements = [1, 2, 3];
            controller.start();
            expect(controller.isRunning).toBe(true);
            expect(controller.latencyMeasurements).toEqual([]);
        });

        it('should stop correctly', () => {
            controller.start();
            controller.stop();
            expect(controller.isRunning).toBe(false);
        });
    });

    describe('Audio Worklet Handling (handleWorkletPitchFrame)', () => {
        const mockFrame = { frequency: 440, confidence: 0.9, note: 'A', octave: 4, captureTime: 1000 };
        const timestamp = 1050; // receiveTime is usually passed as 3rd arg now, or calculated

        beforeEach(() => {
            controller.start();
        });

        it('should not process if stopped', () => {
            controller.stop();
            controller.handleWorkletPitchFrame(mockFrame, 0, 0);
            expect(mockPerformanceMonitor.startProcessing).not.toHaveBeenCalled();
        });

        it('should coordinate all services correctly', () => {
            controller.handleWorkletPitchFrame(mockFrame, 0, 0);

            // 1. Performance Monitor
            expect(mockPerformanceMonitor.startProcessing).toHaveBeenCalled();
            expect(mockPerformanceMonitor.endProcessing).toHaveBeenCalled();
            expect(mockPerformanceMonitor.updateFPS).toHaveBeenCalled();

            // 2. Synth
            expect(mockSynthManager.getActiveEngine).toHaveBeenCalled();
            expect(mockActiveEngine.processPitchFrame).toHaveBeenCalledWith(mockFrame);

            // 3. Visualizer
            expect(mockVisualizerManager.update).toHaveBeenCalledWith(mockFrame);
        });

        it('should calculate latency correctly', () => {
            const receiveTime = 1020;
            const frame = { ...mockFrame, captureTime: 1000 };
            
            controller.handleWorkletPitchFrame(frame, 0, receiveTime);
            
            expect(controller.latencyMeasurements.length).toBe(1);
            expect(controller.latencyMeasurements[0]).toBe(20); // 1020 - 1000
        });

        it('should trigger onStatsUpdate callback if set', () => {
            const callback = vi.fn();
            controller.onStatsUpdate = callback;

            controller.handleWorkletPitchFrame(mockFrame, 0, 0);

            expect(callback).toHaveBeenCalledWith({
                pitchFrame: mockFrame,
                latency: 15.5, // From mockPerformanceMonitor
                fps: 58
            });
        });

        it('should fallback to processPitch if processPitchFrame is missing on engine', () => {
            const legacyEngine = { processPitch: vi.fn() }; // No processPitchFrame
            mockSynthManager.getActiveEngine.mockReturnValueOnce(legacyEngine);

            controller.handleWorkletPitchFrame(mockFrame, 0, 0);

            expect(legacyEngine.processPitch).toHaveBeenCalledWith(mockFrame);
        });
    });

    describe('ScriptProcessor Handling (onAudioProcess)', () => {
        const mockBuffer = new Float32Array(128);
        const mockPitchInfo = { frequency: 220, confidence: 0.8 };

        beforeEach(() => {
            controller.start();
            mockPitchDetector.detect.mockReturnValue(mockPitchInfo);
        });

        it('should detect pitch and process it', () => {
            controller.onAudioProcess(mockBuffer);

            expect(mockPitchDetector.detect).toHaveBeenCalled();
            expect(mockActiveEngine.processPitchFrame).toHaveBeenCalledWith(mockPitchInfo);
            expect(mockVisualizerManager.update).toHaveBeenCalledWith(mockPitchInfo);
        });

        it('should do nothing if no pitch detected', () => {
            mockPitchDetector.detect.mockReturnValue(null);

            controller.onAudioProcess(mockBuffer);

            expect(mockActiveEngine.processPitchFrame).not.toHaveBeenCalled();
            expect(mockVisualizerManager.update).not.toHaveBeenCalled();
        });

        it('should use ExpressiveFeatures if available', () => {
            const enrichedFrame = { ...mockPitchInfo, brightness: 0.5 };
            mockExpressiveFeatures.process.mockReturnValue(enrichedFrame);

            controller.onAudioProcess(mockBuffer);

            expect(mockExpressiveFeatures.process).toHaveBeenCalled();
            expect(mockActiveEngine.processPitchFrame).toHaveBeenCalledWith(enrichedFrame);
        });

        it('should handle ExpressiveFeatures errors gracefully', () => {
            mockExpressiveFeatures.process.mockImplementation(() => { throw new Error('Ops'); });
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            controller.onAudioProcess(mockBuffer);

            // Should fall back to original info and continue
            expect(mockActiveEngine.processPitchFrame).toHaveBeenCalledWith(mockPitchInfo);
            expect(consoleSpy).toHaveBeenCalled();
        });

        it('should trigger AI Harmonizer if enabled', () => {
            mockAiHarmonizer.enabled = true;
            controller.onAudioProcess(mockBuffer);
            expect(mockAiHarmonizer.processFrame).toHaveBeenCalledWith(mockPitchInfo);
        });
    });

    describe('Stats Calculation (getLatencyStats)', () => {
        it('should return zeros if no measurements', () => {
            const stats = controller.getLatencyStats();
            expect(stats.count).toBe(0);
            expect(stats.avg).toBe(0);
        });

        it('should calculate correct statistics', () => {
            controller.latencyMeasurements = [10, 20, 30, 40, 50]; // Sorted

            const stats = controller.getLatencyStats();

            expect(stats.count).toBe(5);
            expect(stats.min).toBe(10);
            expect(stats.max).toBe(50);
            expect(stats.avg).toBe(30);
            expect(stats.p50).toBe(30); // Median
            expect(stats.p95).toBe(50); // Index floor(5 * 0.95) = 4 -> 50
            // Check new estimated total field
            expect(stats.estimatedTotal).toBeDefined();
            expect(stats.estimatedTotal.avg).toBeCloseTo(45, 0); // 30 + 15ms synthesis latency
            expect(stats.note).toContain('Worklet');
        });
    });
});
