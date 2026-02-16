/**
 * Moderyo SDK for TypeScript / Node.js
 *
 * Official client library for the Moderyo Content Moderation API.
 *
 * @example
 * ```typescript
 * import { Moderyo } from '@moderyo/sdk';
 *
 * const client = new Moderyo({
 *   apiKey: process.env.MODERYO_API_KEY!,
 * });
 *
 * const result = await client.moderate({ input: 'Hello, world!' });
 * console.log(result.action); // 'allow' | 'flag' | 'block'
 * ```
 *
 * @packageDocumentation
 */

// Main client
export { Moderyo } from './client.js';

// Types
export type {
  ModeryoConfig,
  ModerationRequest,
  ModerationOptions,
  ModerationResult,
  Decision,
  PolicyDecisionType,
  Severity,
  Categories,
  CategoryScores,
  SimplifiedScores,
  PolicyDecision,
  TriggeredRule,
  Highlight,
  DetectedPhrase,
  LongTextAnalysis,
  Sentence,
  LongTextHighlight,
  ProcessingInfo,
  BatchModerationResult,
  BatchError,
  RateLimitInfo,
  RequestOptions,
  LogLevel,
} from './types.js';

// Errors
export {
  ModeryoError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  APIError,
  NetworkError,
  QuotaExceededError,
  isModeryoError,
  isRetryableError,
} from './errors.js';
