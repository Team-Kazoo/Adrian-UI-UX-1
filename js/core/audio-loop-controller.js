/**
 * @fileoverview Controls the main audio processing loop.
 * Receives audio data/pitch frames from AudioIO, coordinates analysis,
 * synthesis, and visualization, and reports stats back to the UI.
 */

import { calculateRMS } from '../utils/audio-utils.js';

class AudioLoopController {
    /**
     * @param {Object} services
     * @param {Object} services.synthManager - Manages synthesizer engines
     * @param {Object} services.visualizerManager - Manages visualization
     * @param {Object} services.performanceMonitor - Tracks performance metrics
     * @param {Object} [services.pitchDetector] - For ScriptProcessor fallback
     * @param {Object} [services.expressiveFeatures] - For additional feature extraction
     * @param {Object} [services.aiHarmonizer] - For AI accompaniment
     */
    constructor({ 
        synthManager, 
        visualizerManager, 
        performanceMonitor, 
        pitchDetector, 
        expressiveFeatures, 
        aiHarmonizer 
    }) {
        this.synthManager = synthManager;
        this.visualizerManager = visualizerManager;
        this.performanceMonitor = performanceMonitor;
        this.pitchDetector = pitchDetector;
        this.expressiveFeatures = expressiveFeatures;
        this.aiHarmonizer = aiHarmonizer;

        this.isRunning = false;
        this.latencyMeasurements = [];
        
        // Callback for UI updates (pitch, frequency, confidence, latency)
        // @type {Function|null} (stats: { pitchFrame: PitchFrame, latency: number, fps: number }) => void
        this.onStatsUpdate = null; 

        this._workletPitchFrameLogged = false;
    }

    start() {
        this.isRunning = true;
        this.latencyMeasurements = [];
    }

    stop() {
        this.isRunning = false;
    }

    /**
     * Handle complete pitch frame from AudioWorklet
     * @param {PitchFrame} pitchFrame 
     * @param {number} timestamp 
     * @param {number} receiveTime 
     */
    handleWorkletPitchFrame(pitchFrame, timestamp, receiveTime) {
        if (!this.isRunning) return;

        // 1. Latency Measurement
        let currentLatency = 0;
        if (receiveTime && pitchFrame.captureTime) {
            currentLatency = receiveTime - pitchFrame.captureTime;
            this.latencyMeasurements.push(currentLatency);
            if (this.latencyMeasurements.length > 100) {
                this.latencyMeasurements.shift();
            }
        }

        // Debug log once
        if (!this._workletPitchFrameLogged) {
            console.log('[AudioLoop] First Worklet PitchFrame received:', pitchFrame);
            this._workletPitchFrameLogged = true;
        }

        // 2. Performance Monitor Start
        this.performanceMonitor.startProcessing();

        // 3. Synthesis (Core Logic)
        const activeEngine = this.synthManager.getActiveEngine();
        if (activeEngine) {
            // Prefer processPitchFrame API
            if (activeEngine.processPitchFrame) {
                activeEngine.processPitchFrame(pitchFrame);
            } else if (activeEngine.processPitch) {
                activeEngine.processPitch(pitchFrame);
            }
        }

        // 4. Visualization
        if (this.visualizerManager) {
            this.visualizerManager.update(pitchFrame);
        }

        // 5. Performance Monitor End
        this.performanceMonitor.endProcessing();
        this.performanceMonitor.updateFPS();

        // 6. Notify UI (Stats)
        if (this.onStatsUpdate) {
            const metrics = this.performanceMonitor.getMetrics();
            this.onStatsUpdate({
                pitchFrame,
                latency: metrics.totalLatency, // or currentLatency? sticking to totalLatency for consistency
                fps: metrics.fps
            });
        }
    }

    /**
     * Handle ScriptProcessor audio buffer (Fallback)
     * @param {Float32Array} audioBuffer 
     */
    onAudioProcess(audioBuffer) {
        if (!this.isRunning) return;

        this.performanceMonitor.startProcessing();

        // 1. Basic Detection
        const volume = calculateRMS(audioBuffer);
        const pitchInfo = this.pitchDetector ? this.pitchDetector.detect(audioBuffer, volume) : null;

        if (pitchInfo) {
            // 2. Enhance with Expressive Features (if available)
            let pitchFrame = pitchInfo;
            if (this.expressiveFeatures) {
                try {
                    pitchFrame = this.expressiveFeatures.process({
                        pitchInfo,
                        audioBuffer,
                        timestamp: performance.now()
                    });
                } catch (error) {
                    console.error('[AudioLoop] ExpressiveFeatures Error:', error);
                }
            }

            // 3. AI Processing
            if (this.aiHarmonizer && this.aiHarmonizer.enabled) {
                this.aiHarmonizer.processFrame(pitchFrame);
            }

            // 4. Synthesis
            const activeEngine = this.synthManager.getActiveEngine();
            if (activeEngine) {
                if (activeEngine.processPitchFrame) {
                    activeEngine.processPitchFrame(pitchFrame);
                } else {
                    activeEngine.processPitch(pitchInfo);
                }
            }

            // 5. Visualization
            if (this.visualizerManager) {
                this.visualizerManager.update(pitchFrame);
            }

            // 6. Notify UI
            if (this.onStatsUpdate) {
                const metrics = this.performanceMonitor.getMetrics();
                this.onStatsUpdate({
                    pitchFrame,
                    latency: metrics.totalLatency,
                    fps: metrics.fps
                });
            }
        }

        this.performanceMonitor.endProcessing();
        this.performanceMonitor.updateFPS();
    }

    /**
     * Direct pitch detection callback (Fallback middle-ground)
     * @param {Object} pitchInfo 
     */
    onPitchDetected(pitchInfo) {
        if (!this.isRunning) return;

        this.performanceMonitor.startProcessing();

        let pitchFrame = pitchInfo;
        // Note: ExpressiveFeatures incomplete here without buffer, assume pitchInfo is best we got or try dummy buffer
        if (this.expressiveFeatures) {
             // Try to process without buffer if supported, or skip
             // For now, we just pass pitchInfo through
        }

        if (this.aiHarmonizer && this.aiHarmonizer.enabled) {
            this.aiHarmonizer.processFrame(pitchFrame);
        }

        const activeEngine = this.synthManager.getActiveEngine();
        if (activeEngine) {
            if (activeEngine.processPitchFrame) {
                activeEngine.processPitchFrame(pitchFrame);
            } else {
                activeEngine.processPitch(pitchInfo);
            }
        }

        if (this.visualizerManager) {
            this.visualizerManager.update(pitchFrame);
        }

        if (this.onStatsUpdate) {
            const metrics = this.performanceMonitor.getMetrics();
            this.onStatsUpdate({
                pitchFrame,
                latency: metrics.totalLatency,
                fps: metrics.fps
            });
        }

        this.performanceMonitor.endProcessing();
        this.performanceMonitor.updateFPS();
    }

    /**
     * Get latency statistics
     * Note: These measurements are for Worklet → Main Thread only.
     * Actual end-to-end latency includes synthesis output delay (~10-20ms additional).
     * @returns {Object} Latency stats in milliseconds
     */
    getLatencyStats() {
        if (this.latencyMeasurements.length === 0) {
            return {
                min: 0,
                max: 0,
                avg: 0,
                p50: 0,
                p95: 0,
                count: 0,
                note: 'No measurements yet. Start audio to measure latency.'
            };
        }
        const sorted = [...this.latencyMeasurements].sort((a, b) => a - b);

        // Add estimated synthesis output latency (conservative estimate)
        const synthesisLatencyEstimate = 15; // ms

        return {
            min: parseFloat(sorted[0].toFixed(1)),
            max: parseFloat(sorted[sorted.length - 1].toFixed(1)),
            avg: parseFloat((sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(1)),
            p50: parseFloat(sorted[Math.floor(sorted.length * 0.5)].toFixed(1)),
            p95: parseFloat(sorted[Math.floor(sorted.length * 0.95)].toFixed(1)),
            count: sorted.length,
            // Provide estimated total latency
            estimatedTotal: {
                min: parseFloat((sorted[0] + synthesisLatencyEstimate).toFixed(1)),
                avg: parseFloat((sorted.reduce((a, b) => a + b, 0) / sorted.length + synthesisLatencyEstimate).toFixed(1)),
                p95: parseFloat((sorted[Math.floor(sorted.length * 0.95)] + synthesisLatencyEstimate).toFixed(1))
            },
            note: 'Measured: Worklet→Main Thread. Estimated Total includes synthesis output (~15ms).'
        };
    }
}

export { AudioLoopController };
