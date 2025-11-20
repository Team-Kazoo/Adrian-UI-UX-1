# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**Version**: 0.4.0 (Synthesis Optimization)

Kazoo Proto Web is a real-time voice-to-instrument system using Web Audio API. Users sing/hum into their microphone, and the system detects pitch and expression features to drive virtual instruments in real-time.

**Critical Goal**: End-to-end latency < 50ms ✅ **ACHIEVED** (was 180ms, now ~50ms)

### Current Architecture
```
js/
├── main.js                     # KazooApp - main application
├── audio-io.js                 # Audio I/O abstraction (Worklet + ScriptProcessor)
├── pitch-detector.js           # YIN algorithm wrapper
├── pitch-worklet.js            # AudioWorklet processor (YIN + FFT)
├── continuous-synth.js         # Continuous mode synthesizer
├── synthesizer.js              # Legacy synthesizer
├── performance.js              # Performance monitoring
├── expressive-features.js      # Feature extraction pipeline
├── core/
│   └── app-container.js        # Dependency injection container
├── managers/
│   └── ui-manager.js           # UI state management (event-driven)
├── config/
│   ├── app-config.js           # Centralized configuration
│   └── instrument-presets.js   # Instrument definitions
├── features/
│   ├── onset-detector.js       # Attack detection
│   ├── smoothing-filters.js    # Kalman + EMA filters
│   └── spectral-features.js    # FFT-based feature extraction
└── utils/
    ├── audio-utils.js          # Audio processing utilities
    └── logger.js               # Logging utility

tests/
├── unit/
│   └── app-container.test.js   # 19 tests (DI container)
└── config-system.test.js       # Config validation tests

docs/
├── guides/
│   ├── troubleshooting.md      # Common issues
│   └── configuration.md        # Config reference
├── CLEANUP_PLAN.md             # Optimization roadmap
└── CLEANUP_SUMMARY.md          # What was deleted and why
```

### Audio Pipeline
```
Microphone → AudioWorklet → YIN Detection → Feature Extraction → Synthesizer → Output
             (128 samples)    (pitch, clarity)  (volume, timbre)   (Tone.js)
```

## Common Development Commands

```bash
# Development
npm start                       # Start dev server (http://localhost:3000)
npm test                        # Run tests (Vitest)
npm run test:watch              # Run tests in watch mode
npm run test:coverage           # Run tests with coverage

# Debugging (in browser console after starting audio)
window.app.getLatencyStats()    # Get latency measurements (min/max/avg/p50/p95)
window.container.get('audioIO').mode  # Check mode ('worklet' or 'script-processor')
window.container.getServiceNames()    # List all registered services
```

## Core Constraints (Must Follow)

1. **Dependency Injection**: All services registered in AppContainer
   - Access via: `window.container.get('serviceName')`
   - Only expose: `window.app` and `window.container`
   - No global singletons

2. **Configuration**: Single source of truth
   - Use: `configManager.load()`
   - Extend presets in: `js/config/instrument-presets.js`

3. **UI Updates**: Event-driven only
   - Use: `UIManager` events
   - No direct DOM manipulation

4. **Testing**: Vitest only
   - Location: `tests/unit/` or `tests/integration/`
   - Tests must be able to fail
   - No custom test frameworks
   - No predefined success messages

## Performance Targets

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Latency | < 50ms | ~50ms | ✅ Achieved |
| Test Coverage | 40% | ~10% | ⚠️ Needs work |
| Global Variables | 0 | 2 | ⚠️ Acceptable |
| Console Logs | < 50 | 286 | ❌ Too many |

**Priority**: Architecture Refactoring > Test Coverage > Documentation
**Status**: Performance goal achieved. Now focusing on maintainable architecture.

## Documentation Rules

### Root Directory (3 files only)
1. **README.md** - User guide (< 300 lines)
2. **PROJECT_STATUS.md** - Current state (< 250 lines)
3. **CLAUDE.md** - This file (< 200 lines)

### docs/ Structure
```
docs/
├── guides/           # How-to guides
└── *.md             # Planning/cleanup docs
```

### Strict Prohibitions
- ❌ Creating `docs/phase*/` or `docs/step*/` directories
- ❌ Writing "completion reports" or "stage summaries"
- ❌ Using emoji in documentation
- ❌ Creating fake tests with predefined success
- ❌ Execution plans > 200 lines

### Update Principles
1. Code > Docs - Only write if absolutely necessary
2. README first - User-facing information
3. PROJECT_STATUS second - Developer information
4. Long-term plans → GitHub issues, not docs

## Development Workflow Reminders

### Before Making Changes
- Run `npm test` to ensure baseline works
- Check current latency: `window.app.getLatencyStats()`
- Verify Worklet mode: `window.container.get('audioIO').mode`

### After Making Changes
- Run `npm test` to verify tests still pass
- Test in browser with `npm start`
- Measure latency impact with `getLatencyStats()`
- Commit focused changes (one thing per commit)

### Testing Best Practices
- Always run `npm test` before committing
- Write tests that can fail (never fake success)
- Test real audio pipeline, not mocked data
- Integration tests > unit tests for audio code

## Common Pitfalls

1. **AudioWorklet Fallback**
   - System may fall back to ScriptProcessor (2048 buffer = 46ms base latency)
   - Check mode before debugging latency issues
   - Worklet requires HTTPS or localhost

2. **Configuration Not Loading**
   - Must call `configManager.load()` before accessing config
   - Config is singleton, loaded once at startup
   - Changes require page reload

3. **Service Not Found**
   - Service must be registered in AppContainer first
   - Check: `window.container.has('serviceName')`
   - See: `js/main.js` lines 735-843 for registrations

4. **Latency Measurement**
   - `performanceMonitor` measures processing time only
   - `getLatencyStats()` measures end-to-end (capture → output)
   - Need 100+ samples for accurate stats

## Performance Optimization Guidelines

### Likely Bottlenecks (in order)
1. **ScriptProcessor Fallback** (2048 buffer = 46ms)
   - Solution: Ensure Worklet mode is active
   - Check: `window.container.get('audioIO').mode === 'worklet'`

2. **FFT Computation** (SpectralFeatures)
   - Solution: Reduce FFT size or interval
   - Location: `js/features/spectral-features.js`

3. **Expression Feature Extraction**
   - Solution: Disable non-critical features
   - Location: `js/expressive-features.js`

4. **Tone.js Synthesizer**
   - Solution: Reduce filter complexity
   - Location: `js/continuous-synth.js`

### Measurement Strategy
```javascript
// In browser console
const stats = window.app.getLatencyStats()
console.table(stats)
// Look at p95 (95th percentile) for realistic worst-case
```

## v0.3.0 Development Principles

### Testing Philosophy
- **Real tests only** - Every test must be able to fail
- **Vitest CLI mode** - Use `npm test`, not UI mode (disconnected issue)
- **No mocking unless necessary** - Test actual implementations when possible
- **Coverage target** - 15% for v0.3.0 (currently 10%)
- **Test file location** - `tests/unit/` for unit tests

### Development Workflow
- **No voice testing required** - Write tests, reduce console.log, add instrumentation first
- **Voice testing tasks** - Saved for later (latency measurement, profiling, optimization)
- **One feature per commit** - Clear, atomic commits with descriptive messages
- **Run tests before commit** - `npm test` must pass

## Agent Interaction Guidelines

- Use `/catchup` not `/compact` at session start
- When debugging, read code implementation, not docs
- Write tests that can fail, never fake tests
- Delete code rather than comment it out
- One commit per logical change
- Update PROJECT_STATUS.md when completing major tasks

## Anti-Patterns to AVOID (Lessons Learned)

### ❌ Anti-Pattern 1: "Zombie Code"
**Problem**: Replacing CSS/HTML but leaving old code in files
**Example**: Converting `.hero` to Tailwind but not deleting `.hero {}` from CSS
**Rule**: DELETE old code in the SAME commit that adds the replacement
**Why**: Creates confusion, bloats files, makes rollback harder

### ❌ Anti-Pattern 2: "Pray It Works"
**Problem**: Adding classes/code without verifying they function
**Example**: Adding `prose` class without checking if Tailwind Typography plugin is loaded
**Rule**: Test EVERY change in browser before committing
**Why**: Untested code is broken code until proven otherwise

### ❌ Anti-Pattern 3: "Partial Task Completion"
**Problem**: Marking task as "done" when subtasks remain incomplete
**Example**: Task says "modify JS if needed" but you skip checking/modifying JS
**Rule**: Complete ALL parts of a task, or explicitly defer with justification
**Why**: Partial work creates hidden debt and false progress

### ❌ Anti-Pattern 4: "Over-Optimistic Commits"
**Problem**: Commit messages that claim completion when work is incomplete
**Example**: "Complete Phase 4" when T073-T074 are skipped
**Rule**: Commit messages must be brutally honest about what was NOT done
**Why**: Misleading commits waste future developer time

---

## 🎯 PROJECT EVOLUTION: From Prototype to Production-Ready

### Current State Analysis (2025-11-20)

**What We Have:**
- ✅ **Pro-Grade Audio Core**: AudioWorklet + YIN + FastFFT achieving <50ms latency
- ❌ **Prototype-Grade Application Layer**: 1804-line main.js monolith with fragile UI

**The Reality Check:**
This is NOT a "garbage" codebase. It's a **high-performance audio prototype** that needs **architectural maturity** to become production-ready.

### Three-Pillar Strategy

#### 1. Protect & Amplify the Pro-Grade Audio Core
- ✅ Keep: AudioWorklet, YIN algorithm, FFT, Tone.js synthesis
- ✅ Goal: Establish clear boundaries so DSP code remains untouched
- ✅ Principle: Audio engine should be **framework-agnostic**

#### 2. Evolve the Application Layer from Prototype to Production
- 🎯 Target: Break down 1804-line main.js into maintainable modules
- 🎯 Goal: Clear separation of concerns (UI, State, Audio, Devices)
- 🎯 Principle: Enable testing, extensibility, and team collaboration

#### 3. Future-Proof for Features & Commercialization
- 🎯 Enable: Multi-instrument presets, recording, sharing, AI accompaniment
- 🎯 Prevent: "One new feature = codebase earthquake"
- 🎯 Principle: Extensibility without fragility

---

## 🏗️ ARCHITECTURE & DEVELOPMENT PRINCIPLES

### 1. Module Design Principles

#### Single Responsibility Principle (SRP)
Each module does ONE thing well:
- **AudioEngine**: "Give me pitch + features → I give you sound"
- **UIManager**: User interaction & display only
- **DeviceManager**: Input/output device selection & state
- **Warning**: Files > 300 lines or functions > 100 lines = refactor alert

#### Clear Boundaries & Dependency Direction
```
┌─────────────────────────────────────┐
│         UI Layer (Vanilla/React)    │  ← Replaceable
├─────────────────────────────────────┤
│    Application Logic (main.js)      │  ← Orchestration only
├─────────────────────────────────────┤
│  Audio Core (AudioWorklet + Tone)   │  ← Protected, stable
└─────────────────────────────────────┘

Rules:
- Audio core NEVER imports UI
- UI calls audio through clean interfaces
- main.js = assembly point, not god object
```

#### Replaceability
- Audio engine can be extracted as standalone npm package
- UI framework (vanilla → React/Vue) should be swappable
- Business logic should not leak into rendering or DSP

---

### 2. Vibe Coding Principles Applied to This Project

#### ✅ Never Guess Interfaces
- **Action**: Use TypeScript or JSDoc for all public APIs
- **Location**: Define contracts in `types.ts` or module headers
- **Example**:
  ```javascript
  /**
   * @typedef {Object} PitchFrame
   * @property {number} frequency - Detected frequency (Hz)
   * @property {number} confidence - Detection confidence (0-1)
   * @property {string} note - Musical note name (e.g., "A4")
   */
  ```

#### ✅ No Ambiguous State Changes
- **Action**: All state mutations through explicit action functions
- **Good**: `audioActions.start()`, `uiActions.setMode("practice")`
- **Bad**: Randomly mutating global variables in random places
- **Tool**: Consider state machine pattern for audio/UI state

#### ✅ No Assumed Business Logic
- **Action**: Clean out experimental/temporary code from main.js
- **Process**: List actual user paths → Keep only necessary logic
- **Document**: If keeping "future feature hooks", mark them clearly

#### ✅ No Redundant Abstractions
- **Rule**: Already using AudioWorklet + Tone.js? Don't add homebrew audio engine
- **Rule**: If introducing Redux/Pinia, remove hand-written event-bus
- **Principle**: One canonical solution per problem domain

#### ✅ Never Skip Verification
- **Testing**: Vitest unit tests + Playwright/Cypress E2E
- **Coverage Target**: 40%+ (currently ~10%)
- **Critical Paths**: Device selection, audio start/stop, auto-tune toggle, visualizer
- **Philosophy**: Tests must be able to fail (no fake success)

#### ✅ Architecture Preservation
- **Rule**: New features must fit existing module boundaries
- **Red Flag**: If you import many unrelated things → Structure needs refactoring
- **Action**: Fix structure FIRST, then add feature

#### ✅ Document the Unknown
- **Location**: `docs/audio-notes.md` for browser quirks
- **Examples**: AudioContext sample rate issues, devicechange events, iOS limitations
- **Audience**: Future self + collaborators
- **Format**: Problem → Root Cause → Solution/Workaround

---

## 🚫 ANTI-PATTERNS (Expanded)

### ❌ Anti-Pattern 5: "Monolithic main.js"
**Problem**: 1804-line file doing UI + audio + state + rendering
**Example**: KazooApp class handling everything from DOM to FFT
**Rule**: Split into focused modules with <300 lines each
**Why**: Impossible to test, debug, or extend safely

### ❌ Anti-Pattern 6: "Dual Entry Points Without Reason"
**Problem**: `index.html` (old) + `index-new-ai-ui.html` (new) causing confusion
**Example**: Unclear which file is canonical, Tailwind CDN duplication
**Rule**: Merge or delete. One entry point per deployment mode.
**Why**: Maintenance nightmare, CDN dependencies, unclear dev flow

### ❌ Anti-Pattern 7: "Ghost Modules"
**Problem**: Files like `ui-manager.js` exist but are unused
**Example**: Fully implemented UIManager never imported in main.js
**Rule**: Use it or lose it. Document if keeping for future.
**Why**: Dead code creates confusion about which pattern to follow

---

## 📋 REFACTORING CHECKLIST

Before adding ANY new feature, verify:
- [ ] Does this fit in an existing module's responsibility?
- [ ] If no module fits, is the structure wrong?
- [ ] Will this change require touching >3 files? (warning sign)
- [ ] Can I write a test for this? (if no, architecture issue)
- [ ] Am I duplicating existing functionality?

---

## Important Instruction Reminders

**Do what has been asked; nothing more, nothing less.**

- NEVER create documentation files unless explicitly requested
- ALWAYS prefer editing existing files over creating new ones
- ~~Focus on fixing latency~~ ✅ DONE. Now focus on architecture refactoring.
- Write real tests, not fake tests with predetermined results
- Measure impact of architectural changes (don't break the 50ms latency!)
- **Architecture quality now matters as much as working code**

---

**Remember**:
- ✅ Performance goal achieved (~50ms latency)
- 🎯 Next phase: **Maintainable architecture** for long-term evolution
- 🎯 Goal: "Professional audio core + Professional application structure"
