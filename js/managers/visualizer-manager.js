/**
 * @fileoverview Manages the visualizer rendering on a canvas element.
 * It's responsible for drawing the piano roll style pitch history and grid.
 * This manager is decoupled from audio processing and only concerns itself
 * with drawing based on the PitchFrame data it receives.
 */

import { store } from '../state/store.js'; // Assuming VisualizerManager might eventually listen to store for config/styling

class VisualizerManager {
    /**
     * @param {HTMLCanvasElement} canvasElement - The canvas DOM element to draw on.
     * @param {Object} config - Configuration object for the visualizer.
     * @param {number} config.minMidi - The minimum MIDI note to display on the visualizer.
     * @param {number} config.maxMidi - The maximum MIDI note to display on the visualizer.
     * @param {number} config.maxHistory - How many frames of pitch history to keep.
     * @param {string} config.gridColor - Color for the general grid lines.
     * @param {string} config.cNoteColor - Color for C note lines.
     * @param {string} config.activeNoteRowColor - Color for the background of the active note row.
     */
    constructor(canvasElement, config = {}) {
        if (!canvasElement || !(canvasElement instanceof HTMLCanvasElement)) {
            throw new Error('VisualizerManager: A valid HTMLCanvasElement must be provided.');
        }

        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        if (!this.ctx) {
            throw new Error('VisualizerManager: Could not get 2D rendering context from canvas.');
        }

        /** @type {Array<PitchFrame>} */
        this.history = [];
        this.lastFrame = null;

        // Configuration with defaults
        this.config = {
            minMidi: config.minMidi || 40,  // E2
            maxMidi: config.maxMidi || 84,  // C6
            maxHistory: config.maxHistory || 300, // Keep ~5-6 seconds of history at 60fps
            gridColor: config.gridColor || 'rgba(255, 255, 255, 0.05)',
            cNoteColor: config.cNoteColor || 'rgba(255, 255, 255, 0.15)',
            activeNoteRowColor: config.activeNoteRowColor || 'rgba(66, 133, 244, 0.15)',
            font: config.font || '10px Inter, sans-serif',
            labelColor: config.labelColor || 'rgba(255, 255, 255, 0.4)'
        };

        // Bind event listeners
        this._boundResizeHandler = this.resize.bind(this);
        window.addEventListener('resize', this._boundResizeHandler);
    }

    /**
     * Initializes the visualizer.
     * Performs initial resize and redraw.
     */
    init() {
        this.resize();
        this.draw();
    }

    /**
     * Updates the visualizer with a new pitch frame.
     * Adds the frame to history and triggers a redraw.
     * @param {PitchFrame} pitchFrame - The latest pitch data frame.
     */
    update(pitchFrame) {
        // Only record if there's confidence, or record null to indicate a break
        // For line continuity, we record all frames, but handle breaks during drawing
        this.history.push({
            frequency: pitchFrame.frequency,
            confidence: pitchFrame.confidence || 0,
            midi: this._freqToMidi(pitchFrame.frequency),
            timestamp: Date.now() // Use Date.now() for consistency with history management
        });

        if (this.history.length > this.config.maxHistory) {
            this.history.shift();
        }

        this.lastFrame = pitchFrame;
        this.draw();
    }

    /**
     * Resizes the canvas to match its parent container's dimensions.
     * Triggers a redraw after resizing.
     */
    resize() {
        const parent = this.canvas.parentElement;
        if (parent) {
            this.canvas.width = parent.clientWidth;
            this.canvas.height = parent.clientHeight;
        }
        // Redraw immediately after resize to prevent empty canvas
        this.draw();
    }

    /**
     * Draws the current state of the visualizer on the canvas.
     */
    draw() {
        const { ctx, canvas, config } = this;
        const { minMidi, maxMidi } = config;

        const width = canvas.width;
        const height = canvas.height;

        // 1. Clear & Background
        ctx.clearRect(0, 0, width, height);
        
        // 2. Draw Piano Roll Grid (Semitones)
        // Loop through all MIDI notes in range
        const startNote = Math.ceil(minMidi);
        const endNote = Math.floor(maxMidi);
        
        // Calculate current note row to highlight
        const currentFreq = this.lastFrame?.frequency;
        const currentMidi = this._freqToMidi(currentFreq);
        const currentNoteRounded = Math.round(currentMidi);

        ctx.lineWidth = 1;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = config.font;

        for (let i = startNote; i <= endNote; i++) {
            const y = this._midiToY(i, height);
            const isC = i % 12 === 0; // C notes (0=C-1, 12=C0, 24=C1, 36=C2, 48=C3...)
            
            // Highlight current detected note row
            const isCurrentRow = (i === currentNoteRounded) && (this.lastFrame?.confidence > 0.1);

            ctx.beginPath();
            
            if (isCurrentRow) {
                ctx.fillStyle = config.activeNoteRowColor; // Active note row highlight
                const rowHeight = height / (maxMidi - minMidi);
                ctx.fillRect(0, y - rowHeight / 2, width, rowHeight);
            }

            // Grid Line
            if (isC) {
                ctx.strokeStyle = config.cNoteColor;
                ctx.lineWidth = 1;
            } else {
                ctx.strokeStyle = config.gridColor;
                ctx.lineWidth = 0.5;
            }
            
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();

            // Labels for C notes
            if (isC) {
                const octave = Math.floor((i / 12) - 1); // C-1 is MIDI 12, C0 is MIDI 24, etc.
                const noteName = this._midiToNoteName(i);
                ctx.fillStyle = config.labelColor;
                ctx.fillText(`${noteName}${octave}`, 5, y - 2);
            }
        }

        // 3. Draw Pitch History Line (if history is not empty)
        if (this.history.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; // Pitch line color
            ctx.lineWidth = 2;
            
            // Start from the rightmost (most recent) data point
            const latestTimestamp = this.history[this.history.length - 1].timestamp;

            for (let i = 0; i < this.history.length; i++) {
                const frame = this.history[i];
                if (frame.confidence > 0.1) { // Only draw if confidence is high enough
                    const x = width - ((latestTimestamp - frame.timestamp) / (this.config.maxHistory / 60 / 1000) * width); // Scale time to x-axis
                    const y = this._midiToY(frame.midi, height);

                    if (i === 0 || this.history[i-1].confidence <= 0.1) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                } else if (i > 0 && this.history[i-1].confidence > 0.1) {
                    // If current frame has low confidence but previous had high, end the current segment
                    ctx.stroke();
                    ctx.beginPath();
                }
            }
            ctx.stroke();
        }
    }

    /**
     * Helper: Converts frequency to MIDI note number (float).
     * @param {number} freq - Frequency in Hz.
     * @returns {number} MIDI note number.
     * @private
     */
    _freqToMidi(freq) {
        if (!freq || freq <= 0) return 0;
        return 69 + 12 * Math.log2(freq / 440);
    }

    /**
     * Helper: Converts MIDI note number to Y-coordinate on canvas.
     * @param {number} midi - MIDI note number.
     * @param {number} canvasHeight - Height of the canvas.
     * @returns {number} Y-coordinate.
     * @private
     */
    _midiToY(midi, canvasHeight) {
        const { minMidi, maxMidi } = this.config;
        // Map MIDI range to 0-1 (inverted because Canvas Y=0 is top)
        const normalized = 1 - (midi - minMidi) / (maxMidi - minMidi);
        return normalized * canvasHeight;
    }

    /**
     * Helper: Converts MIDI note number to note name (e.g., "C", "C#").
     * @param {number} midi - MIDI note number.
     * @returns {string} Note name.
     * @private
     */
    _midiToNoteName(midi) {
        const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        return noteNames[Math.round(midi) % 12];
    }

    /**
     * Cleans up event listeners.
     */
    destroy() {
        window.removeEventListener('resize', this._boundResizeHandler);
        // Clear canvas context if necessary
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.history = [];
        this.lastFrame = null;
    }
}

export { VisualizerManager };
