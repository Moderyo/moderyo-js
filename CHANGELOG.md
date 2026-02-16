# Changelog

All notable changes to the Moderyo TypeScript/Node.js SDK will be documented in this file.

## [2.0.7] - 2026-02-17

### Added
- Initial public release on npm
- Full TypeScript support with detailed type definitions
- Promise-based async API with automatic retry and exponential backoff
- Rate limiting handling
- Batch processing support (`moderateBatch`)
- Framework integrations: Express middleware, Fastify plugin
- Policy decision support (ALLOW / FLAG / BLOCK)
- Score breakdown: toxicity, hate, harassment, scam, violence, fraud
- Category detection (30+ categories including child safety, extremism)
- Detected phrases with labels
- Configurable options: mode, risk level, playerId
- Content options: skipProfanity, skipThreat, skipMaskedWord, longTextMode

### Technical
- Zero runtime dependencies
- CJS + ESM + DTS outputs via tsup
- Target: Node.js 18+
- TypeScript 5.0+
