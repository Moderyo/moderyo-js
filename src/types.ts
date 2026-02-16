/**
 * Moderyo SDK Type Definitions
 *
 * TypeScript types for request/response models matching the Moderyo API contract.
 * Endpoint: POST /v1/moderation
 */

// =============================================================================
// Configuration
// =============================================================================

export interface ModeryoConfig {
  /** API key for authentication (required). Get yours at https://dashboard.moderyo.com */
  apiKey: string;

  /** Base URL for the API @default 'https://api.moderyo.com' */
  baseUrl?: string;

  /** Request timeout in milliseconds @default 30000 */
  timeout?: number;

  /** Maximum retry attempts for transient errors @default 3 */
  maxRetries?: number;

  /** Base delay for exponential back-off (ms) @default 1000 */
  retryDelay?: number;

  /** Custom headers to include in every request */
  headers?: Record<string, string>;

  /** Callback fired on every SDK error */
  onError?: (error: Error) => void;

  /** Callback fired when a rate-limit response is received */
  onRateLimit?: (info: RateLimitInfo) => void;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter: number;
}

// =============================================================================
// Request
// =============================================================================

export interface ModerationRequest {
  /** Text to moderate — a single string or an array of strings (max 100 items, 10 000 chars each) */
  input: string | string[];

  /** Model to use @default 'omni-moderation-latest' */
  model?: string;

  /** Enable long-text analysis (sentence-level scoring). Auto-detected when null. */
  longTextMode?: boolean;

  /** Character threshold that triggers long-text mode @default 200 */
  longTextThreshold?: number;

  /** Skip profanity detection rules */
  skipProfanity?: boolean;

  /** Skip threat detection rules */
  skipThreat?: boolean;

  /** Skip masked-word detection rules */
  skipMaskedWord?: boolean;
}

// =============================================================================
// Request Options (per-call overrides & headers)
// =============================================================================

export interface ModerationOptions {
  /** Processing mode — 'enforce' applies policy, 'shadow' logs without acting @default 'enforce' */
  mode?: 'enforce' | 'shadow';

  /** Risk sensitivity @default 'balanced' */
  risk?: 'conservative' | 'balanced' | 'aggressive';

  /** Include abuse-signal details in the response */
  debug?: boolean;

  /** Player / user ID for tracking */
  playerId?: string;

  /** Request timeout override (ms) */
  timeout?: number;

  /** Skip retries for this request */
  noRetry?: boolean;

  /** Extra headers for this request only */
  headers?: Record<string, string>;

  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

// =============================================================================
// Response — top level
// =============================================================================

export type Decision = 'allow' | 'flag' | 'block';

export type PolicyDecisionType = 'ALLOW' | 'FLAG' | 'WARN' | 'BLOCK';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface ModerationResult {
  /** Unique moderation ID */
  id: string;

  /** Model used */
  model: string;

  /** Whether the content was flagged by AI */
  flagged: boolean;

  /** Final action after policy evaluation */
  action: Decision;

  /** Per-category boolean flags (27 categories) */
  categories: Categories;

  /** Per-category confidence scores 0 – 1 (27 categories) */
  categoryScores: CategoryScores;

  /** Simplified aggregate scores 0 – 1 */
  scores: SimplifiedScores;

  /** Policy decision details (rule that fired, reason, severity, etc.) */
  policyDecision?: PolicyDecision;

  /** Detected phrases — profanity, scam keywords, threats, etc. */
  detectedPhrases?: DetectedPhrase[];

  /** Processing mode used */
  mode?: 'enforce' | 'shadow';

  /** Risk sensitivity used */
  risk?: 'conservative' | 'balanced' | 'aggressive';

  /** Overall safety score 0 – 100 (higher = safer) */
  safetyScore?: number;

  /** Long-text analysis details (when long_text_mode is active) */
  longTextAnalysis?: LongTextAnalysis;

  /** Abuse-signal details (only when debug = true) */
  abuseSignals?: Record<string, unknown>;

  /** Shadow-mode decision details (only in shadow mode) */
  shadowDecision?: Record<string, unknown>;
}

// =============================================================================
// Categories — 27 total
//   11 standard  +  4 self-harm  +  4 violence  +  4 child  +  4 extremism
// =============================================================================

export interface Categories {
  // — Standard (11) —
  hate: boolean;
  'hate/threatening': boolean;
  harassment: boolean;
  'harassment/threatening': boolean;
  'self-harm': boolean;
  'self-harm/intent': boolean;
  'self-harm/instructions': boolean;
  sexual: boolean;
  'sexual/minors': boolean;
  violence: boolean;
  'violence/graphic': boolean;

  // — Moderyo Safety: Self-Harm (4) —
  self_harm_ideation: boolean;
  self_harm_intent: boolean;
  self_harm_instruction: boolean;
  self_harm_support: boolean;

  // — Moderyo Safety: Violence (4) —
  violence_general: boolean;
  violence_severe: boolean;
  violence_instruction: boolean;
  violence_glorification: boolean;

  // — Moderyo Safety: Child Protection (4) —
  child_sexual_content: boolean;
  minor_sexualization: boolean;
  child_grooming: boolean;
  age_mention_risk: boolean;

  // — Moderyo Safety: Extremism (4) —
  extremism_violence_call: boolean;
  extremism_propaganda: boolean;
  extremism_support: boolean;
  extremism_symbol_reference: boolean;

  /** Allow additional / future categories */
  [key: string]: boolean;
}

export interface CategoryScores {
  // — Standard (11) —
  hate: number;
  'hate/threatening': number;
  harassment: number;
  'harassment/threatening': number;
  'self-harm': number;
  'self-harm/intent': number;
  'self-harm/instructions': number;
  sexual: number;
  'sexual/minors': number;
  violence: number;
  'violence/graphic': number;

  // — Moderyo Safety: Self-Harm (4) —
  self_harm_ideation: number;
  self_harm_intent: number;
  self_harm_instruction: number;
  self_harm_support: number;

  // — Moderyo Safety: Violence (4) —
  violence_general: number;
  violence_severe: number;
  violence_instruction: number;
  violence_glorification: number;

  // — Moderyo Safety: Child Protection (4) —
  child_sexual_content: number;
  minor_sexualization: number;
  child_grooming: number;
  age_mention_risk: number;

  // — Moderyo Safety: Extremism (4) —
  extremism_violence_call: number;
  extremism_propaganda: number;
  extremism_support: number;
  extremism_symbol_reference: number;

  /** Allow additional / future categories */
  [key: string]: number;
}

// =============================================================================
// Simplified Scores (policy-boosted aggregates)
// =============================================================================

export interface SimplifiedScores {
  toxicity: number;
  hate: number;
  harassment: number;
  scam: number;
  violence: number;
  fraud: number;
  [key: string]: number;
}

// =============================================================================
// Policy Decision
// =============================================================================

export interface PolicyDecision {
  /** Final decision */
  decision: PolicyDecisionType;
  /** ID of the triggered rule */
  ruleId: string;
  /** Human-readable rule name */
  ruleName: string;
  /** Explanation */
  reason: string;
  /** Confidence 0 – 100 */
  confidence: number;
  /** Severity level */
  severity: Severity;
  /** Details about the specific rule */
  triggeredRule?: TriggeredRule;
  /** Highlighted text segments */
  highlights?: Highlight[];
}

export interface TriggeredRule {
  id: string;
  type: string;
  category: string;
  threshold: number;
  actualValue: number;
  matched: boolean;
}

export interface Highlight {
  text: string;
  category: string;
  startIndex: number;
  endIndex: number;
}

// =============================================================================
// Detected Phrases
// =============================================================================

export interface DetectedPhrase {
  /** Detected text fragment */
  text: string;
  /** Category label — profanity | insult | scam | threat | hate | violence */
  label: string;
}

// =============================================================================
// Long-Text Analysis
// =============================================================================

export interface LongTextAnalysis {
  overallToxicity: number;
  maxToxicity: number;
  top3MeanToxicity: number;
  decisionConfidence: number;
  signalConfidence: number;
  sentences: Sentence[];
  highlights: LongTextHighlight[];
  processing: ProcessingInfo;
}

export interface Sentence {
  index: number;
  text: string;
  start: number;
  end: number;
  charCount: number;
  toxicity: number;
  decision: string;
}

export interface LongTextHighlight {
  text: string;
  start: number;
  end: number;
  score: number;
  source: string;
  basis: string;
}

export interface ProcessingInfo {
  mode: string;
  originalCharCount: number;
  processedCharCount: number;
  originalSentenceCount: number;
  finalSentenceCount: number;
  truncated: boolean;
  truncationReason: string | null;
  inferenceTimeMs: number;
}

// =============================================================================
// Batch
// =============================================================================

export interface BatchModerationResult {
  total: number;
  successful: number;
  failed: number;
  flaggedCount: number;
  blockedCount: number;
  results: ModerationResult[];
  errors?: BatchError[];
}

export interface BatchError {
  index: number;
  error: string;
  code?: string;
}

// =============================================================================
// Utility / backward-compat
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/** @deprecated Use ModerationOptions instead */
export type RequestOptions = ModerationOptions;
