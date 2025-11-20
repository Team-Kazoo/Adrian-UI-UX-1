import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VisualizerManager } from '../../js/managers/visualizer-manager.js';

describe('VisualizerManager', () => {
    let visualizer;
    let mockCanvas;
    let mockCtx;

    beforeEach(() => {
        // Mock Canvas Context
        mockCtx = {
            clearRect: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            fill: vi.fn(),
            fillRect: vi.fn(),
            arc: vi.fn(),
            fillText: vi.fn(),
            roundRect: vi.fn(),
            createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 1,
            font: '',
            shadowBlur: 0,
            shadowColor: ''
        };

        // Mock Canvas Element
        mockCanvas = {
            getContext: vi.fn().mockReturnValue(mockCtx),
            width: 0,
            height: 0,
            parentElement: {
                clientWidth: 800,
                clientHeight: 600
            }
        };

        vi.clearAllMocks();
    });

    describe('Initialization', () => {
        it('should throw if no canvas provided', () => {
            // We need to bypass the instanceof check for this test if running in node without jsdom
            // But since we mock HTMLCanvasElement check inside the class?
            // The class has: if (!canvasElement || !(canvasElement instanceof HTMLCanvasElement))
            
            // In vitest + jsdom environment, HTMLCanvasElement exists.
            // We can mock the instance check or pass a "real" mock.
            // For simplicity, let's just check null.
            expect(() => new VisualizerManager(null)).toThrow();
        });

        it('should initialize with default config', () => {
            // Mock instanceof check bypass
            const originalInstanceof = HTMLCanvasElement;
            global.HTMLCanvasElement = Object; // Hack to pass instanceof check with plain object

            visualizer = new VisualizerManager(mockCanvas);
            
            expect(visualizer.config.minMidi).toBe(40);
            expect(visualizer.config.maxHistory).toBe(300);
            
            global.HTMLCanvasElement = originalInstanceof; // Restore
        });

        it('should merge user config', () => {
            global.HTMLCanvasElement = Object;
            visualizer = new VisualizerManager(mockCanvas, { minMidi: 20, gridColor: 'red' });
            
            expect(visualizer.config.minMidi).toBe(20);
            expect(visualizer.config.gridColor).toBe('red');
            expect(visualizer.config.maxHistory).toBe(300); // Default preserved
            global.HTMLCanvasElement = originalInstanceof;
        });
    });

    describe('Core Logic', () => {
        beforeEach(() => {
            global.HTMLCanvasElement = Object;
            visualizer = new VisualizerManager(mockCanvas);
            global.HTMLCanvasElement = originalInstanceof;
        });

        it('should resize canvas to match parent', () => {
            visualizer.resize();
            expect(mockCanvas.width).toBe(800);
            expect(mockCanvas.height).toBe(600);
        });

        it('should update history on new frame', () => {
            const frame = { frequency: 440, confidence: 0.9 };
            visualizer.update(frame);

            expect(visualizer.history.length).toBe(1);
            expect(visualizer.history[0].frequency).toBe(440);
            expect(visualizer.history[0].midi).toBeCloseTo(69); // A4 = 69
        });

        it('should maintain max history length', () => {
            visualizer.config.maxHistory = 5;
            
            for (let i = 0; i < 10; i++) {
                visualizer.update({ frequency: 440, confidence: 1 });
            }

            expect(visualizer.history.length).toBe(5);
        });

        it('should trigger draw on update', () => {
            const drawSpy = vi.spyOn(visualizer, 'draw');
            visualizer.update({ frequency: 440, confidence: 1 });
            expect(drawSpy).toHaveBeenCalled();
        });
    });

    // Helper needed for tests
    const originalInstanceof = global.HTMLCanvasElement || Object;
});
