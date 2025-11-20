import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SynthManager } from '../../js/managers/synth-manager.js';
import { store } from '../../js/state/store.js';

// Mock Engines
const mockContinuousEngine = {
    changeInstrument: vi.fn(),
    setReverbWet: vi.fn(),
    setDelayWet: vi.fn(),
    setAutoTuneStrength: vi.fn(),
    setRetuneSpeed: vi.fn(),
    setScale: vi.fn(),
    stop: vi.fn()
};

const mockLegacyEngine = {
    changeInstrument: vi.fn(),
    setReverbWet: vi.fn(),
    setDelayWet: vi.fn(),
    stop: vi.fn()
};

describe('SynthManager', () => {
    let synthManager;

    beforeEach(() => {
        // Reset Store
        store.setState({
            synth: {
                instrument: 'flute',
                continuousMode: true,
                autoTune: { enabled: false, strength: 0.5, speed: 0.1, key: 'C', scale: 'major' },
                reverbWet: 0.2,
                delayWet: 0.0
            }
        });

        // Reset Mocks
        vi.clearAllMocks();

        synthManager = new SynthManager({
            continuous: mockContinuousEngine,
            legacy: mockLegacyEngine
        });
    });

    describe('Initialization', () => {
        it('should sync engines with initial store state on init', () => {
            synthManager.init();

            // Check Mode
            expect(synthManager.activeEngine).toBe(mockContinuousEngine);

            // Check Instrument
            expect(mockContinuousEngine.changeInstrument).toHaveBeenCalledWith('flute');

            // Check Effects
            expect(mockContinuousEngine.setReverbWet).toHaveBeenCalledWith(0.2);
            expect(mockContinuousEngine.setDelayWet).toHaveBeenCalledWith(0.0);
        });
    });

    describe('Mode Switching', () => {
        it('should switch to legacy engine and update store', () => {
            synthManager.setMode(false);

            expect(synthManager.activeEngine).toBe(mockLegacyEngine);
            expect(store.getState().synth.continuousMode).toBe(false);
        });

        it('should switch back to continuous engine', () => {
            synthManager.setMode(false); // First switch to legacy
            synthManager.setMode(true);  // Then back to continuous

            expect(synthManager.activeEngine).toBe(mockContinuousEngine);
            expect(store.getState().synth.continuousMode).toBe(true);
        });
    });

    describe('Instrument Selection', () => {
        it('should update store and call active engine', () => {
            synthManager.setInstrument('cello');

            expect(mockContinuousEngine.changeInstrument).toHaveBeenCalledWith('cello');
            expect(store.getState().synth.instrument).toBe('cello');
        });

        it('should handle engine errors gracefully', () => {
            mockContinuousEngine.changeInstrument.mockImplementationOnce(() => {
                throw new Error('Load failed');
            });

            // Should not throw
            synthManager.setInstrument('error-instrument');
            
            // Store should still update? Or logic implies it might abort?
            // Current impl updates store BEFORE checking engine success? No, Engine first.
            // Wait, looking at code: Engine 1st, Store 2nd.
            // If engine fails, store should NOT update.
            
            // Let's verify behavior. Code says:
            /*
            try {
                this.activeEngine.changeInstrument(instrumentId);
            } catch (err) { ... return; }
            */
           
            expect(store.getState().synth.instrument).not.toBe('error-instrument');
        });
    });

    describe('Effects Control', () => {
        it('should update reverb and store', () => {
            synthManager.setReverb(0.5);
            expect(mockContinuousEngine.setReverbWet).toHaveBeenCalledWith(0.5);
            expect(store.getState().synth.reverbWet).toBe(0.5);
        });

        it('should clamp reverb values', () => {
            synthManager.setReverb(1.5);
            expect(mockContinuousEngine.setReverbWet).toHaveBeenCalledWith(1.0);
            expect(store.getState().synth.reverbWet).toBe(1.0);
        });

        it('should update delay and store', () => {
            synthManager.setDelay(0.8);
            expect(mockContinuousEngine.setDelayWet).toHaveBeenCalledWith(0.8);
            expect(store.getState().synth.delayWet).toBe(0.8);
        });
    });

    describe('Auto-Tune Configuration', () => {
        it('should update strength when enabled', () => {
            synthManager.setAutoTuneConfig({ enabled: true, strength: 0.8 });
            
            expect(mockContinuousEngine.setAutoTuneStrength).toHaveBeenCalledWith(0.8);
            expect(store.getState().synth.autoTune.strength).toBe(0.8);
            expect(store.getState().synth.autoTune.enabled).toBe(true);
        });

        it('should set strength to 0 when disabled', () => {
            synthManager.setAutoTuneConfig({ enabled: false });
            
            // It sends 0 to the engine, but keeps original strength in store for later
            expect(mockContinuousEngine.setAutoTuneStrength).toHaveBeenCalledWith(0);
            expect(store.getState().synth.autoTune.enabled).toBe(false);
        });

        it('should update scale and key', () => {
            synthManager.setAutoTuneConfig({ key: 'D', scale: 'minor' });
            
            expect(mockContinuousEngine.setScale).toHaveBeenCalledWith('D', 'minor');
            expect(store.getState().synth.autoTune.key).toBe('D');
            expect(store.getState().synth.autoTune.scale).toBe('minor');
        });
    });
});