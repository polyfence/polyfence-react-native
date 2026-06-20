# Contributing to Polyfence React Native

Thank you for your interest in contributing to Polyfence! We welcome bug reports, feature requests, and pull requests.

## Code of Conduct

Please read and follow our [Code of Conduct](./CODE_OF_CONDUCT.md). We are committed to providing a welcoming and inspiring community for all.

## How to Contribute

### Reporting Bugs

Found a bug? Please open a GitHub issue with:
- A clear, descriptive title
- Steps to reproduce the problem
- Expected behavior
- Actual behavior
- Your environment (React Native version, platform, etc.)

### Suggesting Features

Have an idea? Open a GitHub discussion or issue labeled `enhancement` with:
- What you want to do
- Why you think it's useful
- Alternative approaches you've considered

### Asking Questions

Use GitHub Discussions for questions about how to use the library. For security concerns, see [SECURITY.md](./SECURITY.md).

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- React Native 0.73 or higher
- Android Studio (for Android development)
- Xcode 14+ (for iOS development)

### Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/polyfence-react-native.git
   cd polyfence-react-native
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Build the TypeScript:
   ```bash
   npm run build
   ```

### Running the Example App

```bash
# Install example dependencies
cd example
npm install

# Android
npm run android

# iOS
cd ios
pod install
cd ..
npm run ios
```

## Code Style

### TypeScript

- Enable strict mode in your editor
- Use 2-space indentation
- Format with Prettier (runs on commit)
- Type all public APIs
- Avoid `any` — use generics or union types instead

### Kotlin (Android)

- JVM target 1.8
- Use companion objects for static members
- Follow official Kotlin style guide
- Package: `io.polyfence.reactnative`

### Swift (iOS)

- iOS 14.0+ APIs only
- Follow Apple's Swift API Design Guidelines
- Use protocol-oriented programming where possible
- Annotate deprecated APIs with `@available`

### General Rules

- No emoji characters in production code
- No conversational AI-style comments ("As an AI", "Here's", "Let me")
- Comments should explain WHY, not WHAT
- Keep functions focused and testable

## Commit Messages

Use conventional commit format:

```
feat: add location tracking initialization
fix: resolve race condition in zone detection
docs: update API documentation
refactor: simplify event dispatch logic
test: add tests for boundary detection
chore: update dependencies
```

## Pull Request Process

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. Make your changes and test both platforms:
   ```bash
   npm run build
   npm run lint
   npm test
   cd android && ./gradlew build
   cd ../ios && pod lib lint polyfence-react-native.podspec --allow-warnings
   ```

3. Commit with a clear message (see above)

4. Push your branch and open a pull request:
   - Reference any related issues with "Fixes #123"
   - Describe what changed and why
   - Include any breaking changes prominently

5. Ensure CI passes and request a review

6. Address feedback and iterate

## What We Look For

- **Tests** — New features should include tests. Fixes should have failing tests that now pass.
- **Platform parity** — Changes to one platform (Android/iOS) should consider both.
- **Privacy** — No additional tracking, analytics, or network calls. All location processing happens on-device.
- **Documentation** — Public APIs need JSDoc comments. Complex logic needs explanation.
- **No breaking changes** — Unless approved by maintainers with a deprecation plan.

## Architecture Guidelines

This is a thin bridge to polyfence-core. Keep these principles in mind:

- **No geofencing logic in this repo** — Detection algorithms live in polyfence-core only
- **Minimal bridge logic** — Transform types between native (Kotlin/Swift) and TypeScript
- **Event streaming** — Use native event emitters (RCTEventEmitter on iOS, EventEmitter on Android)
- **Error handling** — Map platform-specific exceptions to typed TypeScript errors (`PolyfenceError`)

## Testing

### TypeScript

Tests use Jest:

```bash
npm test
```

Write tests for:
- Type definitions (compile-time checks)
- Model serialization/deserialization
- Error handling
- Event stream setup

### Native Code

Native tests run in Android Studio and Xcode. Manual testing on physical devices is required for location features.

## Documentation

Update documentation when you:
- Add a public API
- Change behavior
- Fix a bug that might confuse users
- Add a new code example

## Questions?

- Check existing [issues](https://github.com/polyfence/polyfence-react-native/issues)
- Read the API documentation in the `README.md` "API Reference" section + the JSDoc on each method in `src/`
- Open a GitHub Discussion

Thank you for contributing!
