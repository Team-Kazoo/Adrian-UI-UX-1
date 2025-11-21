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
            scale: vi.fn(),
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
                clientHeight: 600,
                getBoundingClientRect: vi.fn().mockReturnValue({ width: 800, height: 600 })
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
            
            expect(visualizer.config.minMidi).toBe(36);
            expect(visualizer.config.historySize).toBe(300);
            
            global.HTMLCanvasElement = originalInstanceof; // Restore
        });

        it('should merge user config', () => {
            global.HTMLCanvasElement = Object;
            visualizer = new VisualizerManager(mockCanvas, { minMidi: 20, gridColor: 'red' });
            
            expect(visualizer.config.minMidi).toBe(20);
            expect(visualizer.config.gridColor).toBe('red');
            expect(visualizer.config.historySize).toBe(300); // Default preserved
            global.HTMLCanvasElement = originalInstanceof;
        });
    });

    describe('Core Logic', () => {
        beforeEach(() => {
            global.HTMLCanvasElement = Object;
            visualizer = new VisualizerManager(mockCanvas);
            // Start loop to allow drawing
            visualizer.isRunning = true; 
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

            expect(visualizer.points.length).toBe(1);
            // points structure: { y, valid, confidence }
            // A4 (440Hz) -> MIDI 69. 
            // minMidi 36, maxMidi 84. range 48.
            // y = 1 - (69 - 36) / 48 = 1 - 33/48 = 1 - 0.6875 = 0.3125
            expect(visualizer.points[0].y).toBeCloseTo(0.3125); 
        });

        it('should maintain max history length', () => {
            visualizer.config.historySize = 5;
            
            for (let i = 0; i < 10; i++) {
                visualizer.update({ frequency: 440, confidence: 1 });
            }

            expect(visualizer.points.length).toBe(5);
        });
        
        // Removed draw trigger test as update() only updates data
    });

    // Helper needed for tests
    const originalInstanceof = global.HTMLCanvasElement || Object;
});
