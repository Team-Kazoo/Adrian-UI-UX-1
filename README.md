# Kazoo Proto Web

Real-time voice-to-instrument system powered by Web Audio API.

Sing or hum into your microphone, and transform your voice into virtual instruments in real-time with expressive features like vibrato, brightness, and articulation.

## Quick Start

```bash
npm install
npm start
```

Open `http://localhost:3000` in your browser.

## Features

- **Real-time Pitch Detection**: YIN algorithm running in AudioWorklet for ultra-low latency
- **6 Virtual Instruments**: Saxophone, Violin, Piano, Flute, Guitar, Synthesizer
- **Expressive Mapping**: Volume, timbre (brightness), breathiness, articulation detection
- **Auto-Tune**: Scale quantization with adjustable retune speed
- **Low Latency**: ~50ms end-to-end latency (target achieved!)
- **Device Selection**: Choose input/output audio devices

## Architecture

```text
Microphone → AudioWorklet → YIN Detection → Feature Extraction → Synthesizer → Output
             (128 samples)    (pitch/clarity)  (volume/timbre)    (Tone.js)
```

### Key Components

- **AudioIO** (`js/audio-io.js`): Audio I/O abstraction with Worklet + ScriptProcessor fallback
- **PitchDetector** (`js/pitch-detector.js`): YIN algorithm wrapper
- **ContinuousSynth** (`js/continuous-synth.js`): Real-time frequency tracking synthesizer
- **ExpressiveFeatures** (`js/expressive-features.js`): Feature extraction pipeline
- **AppContainer** (`js/core/app-container.js`): Dependency injection container

## Development

### Commands

```bash
npm test              # Run tests (Vitest)
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm start             # Dev server
```

### Browser Console Debugging

```javascript
// Check latency statistics
window.app.getLatencyStats()

// Verify Worklet mode (should be 'worklet', not 'script-processor')
window.container.get('audioIO').mode

// List all registered services
window.container.getServiceNames()
```

## Performance

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Latency | < 50ms | ~50ms | ✅ Achieved |
| Test Coverage | 40% | ~10% | 🔄 In Progress |
| Audio Mode | Worklet | Worklet | ✅ Optimized |

## Browser Support

- Chrome/Edge 66+
- Firefox 76+
- Safari 14.1+

Requires HTTPS or localhost for AudioWorklet support.

## Project Status

**Version**: 0.4.0 (Synthesis Optimization)
**Branch**: feat/auto-tune

See [PROJECT_STATUS.md](PROJECT_STATUS.md) for detailed development status.

## Documentation

- [Architecture Overview](docs/ARCHITECTURE_OVERVIEW.md)
- [Latency Optimization](docs/LATENCY_OPTIMIZATION.md)
- [Configuration Guide](docs/guides/configuration.md)
- [Troubleshooting](docs/guides/troubleshooting.md)
- [Full Documentation Index](docs/README.md)

## Development Guidelines

See [CLAUDE.md](CLAUDE.md) for:

- Dependency injection patterns
- Testing requirements
- Performance targets
- Commit conventions

## License

MIT

## Credits

Built with:

- [Tone.js](https://tonejs.github.io/) - Web Audio framework
- [pitchfinder](https://github.com/peterkhayes/pitchfinder) - YIN algorithm implementation
- Web Audio API - Low-latency audio processing
