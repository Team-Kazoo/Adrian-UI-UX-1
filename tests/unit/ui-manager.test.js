/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import UIManager from '../../js/managers/ui-manager.js';

describe('UIManager', () => {
  let uiManager;
  
  // Mock DOM elements
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="startBtn"></button>
      <button id="stopBtn"></button>
      <div id="recordingStatus"></div>
      <div id="systemStatus"></div>
      <div id="latency"></div>
      <div id="confidence"></div>
      <div id="note-display"></div>
      <div id="note-text"></div>
      <div id="frequency-display"></div>
      <div id="cents-display"></div>
      <div id="visualizer"></div>
      <div id="statusBar"></div>
      <canvas id="pitch-canvas"></canvas>
      <button class="instrument-btn" data-instrument="saxophone"></button>
      <div id="warning-box"></div>
      <div id="warning-text"></div>
      
      <!-- Tuner Display Elements -->
      <div id="tunerDisplay" class="hidden"></div>
      <div id="tunerInput"></div>
      <div id="tunerTarget"></div>
      <div id="tunerCents"></div>
    `;
    
    uiManager = new UIManager();
    uiManager.initialize();
  });

  describe('updateTunerDisplay', () => {
    it('应该显示调音器信息', () => {
      const info = {
        inputNote: 'C#',
        inputOctave: 4,
        note: 'D',
        octave: 4,
        inputCents: -35,
        cents: 0
      };

      uiManager.updateTunerDisplay(info);

      const display = document.getElementById('tunerDisplay');
      const input = document.getElementById('tunerInput');
      const target = document.getElementById('tunerTarget');
      const cents = document.getElementById('tunerCents');

      expect(display.classList.contains('hidden')).toBe(false);
      expect(input.textContent).toBe('C#4');
      expect(target.textContent).toBe('D4');
      expect(cents.textContent).toContain('(-35¢)');
    });

    it('应该在信息为空时隐藏调音器', () => {
      uiManager.updateTunerDisplay(null);
      const display = document.getElementById('tunerDisplay');
      expect(display.classList.contains('hidden')).toBe(true);
    });

    it('应该根据音分误差显示不同颜色', () => {
      // High error -> Gray
      uiManager.updateTunerDisplay({ inputCents: 40, cents: 0 });
      let cents = document.getElementById('tunerCents');
      expect(cents.className).toContain('text-gray-400');
      
      // Low error -> Green
      uiManager.updateTunerDisplay({ inputCents: 5, cents: 0 });
      cents = document.getElementById('tunerCents');
      expect(cents.className).toContain('text-green-500');
    });
  });
});
