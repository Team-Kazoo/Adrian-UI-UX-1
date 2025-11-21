/**
 * Music Scales & Theory Utilities
 * 
 * 提供音乐调式定义和量化算法
 * 
 * @module MusicScales
 */

export const SCALES = {
    chromatic: { name: 'Chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    major:     { name: 'Major',     intervals: [0, 2, 4, 5, 7, 9, 11] },
    minor:     { name: 'Minor',     intervals: [0, 2, 3, 5, 7, 8, 10] },
    pentatonic_major: { name: 'Major Pentatonic', intervals: [0, 2, 4, 7, 9] },
    pentatonic_minor: { name: 'Minor Pentatonic', intervals: [0, 3, 5, 7, 10] },
    blues:     { name: 'Blues',     intervals: [0, 3, 5, 6, 7, 10] }
};

export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * 频率转 MIDI Note Number
 */
export function freqToMidi(freq) {
    if (!freq || freq <= 0) return 0;
    return 69 + 12 * Math.log2(freq / 440);
}

/**
 * MIDI Note Number 转频率
 */
export function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * 获取最近的调内音符
 * 
 * @param {number} inputFreq - 输入频率
 * @param {string} rootKey - 根音 (e.g., 'C', 'F#')
 * @param {string} scaleType - 调式类型 key of SCALES
 * @returns {Object} { frequency, midi, noteName, deviation }
 */
export function getNearestScaleNote(inputFreq, rootKey = 'C', scaleType = 'chromatic') {
    const inputMidi = freqToMidi(inputFreq);
    const rootIndex = KEYS.indexOf(rootKey);
    const scale = SCALES[scaleType] || SCALES.chromatic;
    
    // 1. 找到最近的 Chromatic Semitone (整数 MIDI)
    const nearestSemi = Math.round(inputMidi);
    
    // 2. 检查这个音是否在调内
    // (Note - Root) % 12 = Interval
    let noteChroma = (nearestSemi % 12 + 12) % 12; // 0-11
    let rootChroma = rootIndex;
    let interval = (noteChroma - rootChroma + 12) % 12;
    
    // 3. 如果不在调内，寻找最近的调内音
    if (!scale.intervals.includes(interval)) {
        // 寻找最近的合法 interval
        let minDist = 100;
        let bestInterval = 0;
        
        for (let validInterval of scale.intervals) {
            // 计算距离 (考虑循环，比如 11 到 0 的距离是 1)
            let dist = Math.abs(validInterval - interval);
            if (dist > 6) dist = 12 - dist; // Wrap around correction
            
            if (dist < minDist) {
                minDist = dist;
                bestInterval = validInterval;
            }
        }
        
        // 修正 Note Chroma
        // NewNote = Root + BestInterval
        let targetChroma = (rootChroma + bestInterval) % 12;
        
        // 决定是向上修还是向下修
        // 简单做法：直接替换 Chroma，保持 Octave
        // 复杂做法：判断最近的邻居是在上面还是下面
        // 这里使用简单的 diff 方法
        let diff = targetChroma - noteChroma;
        if (diff > 6) diff -= 12;
        if (diff < -6) diff += 12;
        
        var targetMidi = nearestSemi + diff;
    } else {
        var targetMidi = nearestSemi;
    }
    
    return {
        frequency: midiToFreq(targetMidi),
        midi: targetMidi,
        noteName: KEYS[targetMidi % 12],
        centsDeviation: (inputMidi - targetMidi) * 100
    };
}
