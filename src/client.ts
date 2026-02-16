/**
 * Moderyo SDK Client
 *
 * Main client class for the Moderyo Content Moderation API.
 * Endpoint: POST /v1/moderation
 */

import type {
  ModeryoConfig,
  ModerationRequest,
  ModerationResult,
  ModerationOptions,
  BatchModerationResult,
  Categories,
  CategoryScores,
  SimplifiedScores,
  PolicyDecision,
  LongTextAnalysis,
} from './types.js';

import {
  ModeryoError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  APIError,
  NetworkError,
  QuotaExceededError,
  isRetryableError,
} from './errors.js';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_BASE_URL = 'https://api.moderyo.com';
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1_000;
const SDK_VERSION = '0.2.0';

/** All 27 category keys used to provide defaults */
const ALL_CATEGORIES = [
  // Standard (11)
  'hate', 'hate/threatening',
  'harassment', 'harassment/threatening',
  'self-harm', 'self-harm/intent', 'self-harm/instructions',
  'sexual', 'sexual/minors',
  'violence', 'violence/graphic',
  // Safety: Self-Harm (4)
  'self_harm_ideation', 'self_harm_intent', 'self_harm_instruction', 'self_harm_support',
  // Safety: Violence (4)
  'violence_general', 'violence_severe', 'violence_instruction', 'violence_glorification',
  // Safety: Child Protection (4)
  'child_sexual_content', 'minor_sexualization', 'child_grooming', 'age_mention_risk',
  // Safety: Extremism (4)
  'extremism_violence_call', 'extremism_propaganda', 'extremism_support', 'extremism_symbol_reference',
] as const;

// =============================================================================
// Client
// =============================================================================

/**
 * Moderyo client for content moderation.
 *
 * @example
 * ```typescript
 * const client = new Moderyo({ apiKey: process.env.MODERYO_API_KEY! });
 *
 * const result = await client.moderate({ input: 'Hello, world!' });
 * console.log(result.action); // 'allow'
 * ```
 */
export class Moderyo {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly headers: Record<string, string>;
  private readonly onError?: (error: Error) => void;
  private readonly onRateLimit?: (info: { limit: number; remaining: number; reset: Date; retryAfter: number }) => void;

  constructor(config: ModeryoConfig) {
    if (!config.apiKey) {
      throw new ValidationError('API key is required', { field: 'apiKey' });
    }

    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryDelay = config.retryDelay ?? DEFAULT_RETRY_DELAY;
    this.headers = config.headers ?? {};
    this.onError = config.onError;
    this.onRateLimit = config.onRateLimit;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Moderate a single piece of content.
   *
   * @param request - A {@link ModerationRequest} object **or** a plain string (shorthand).
   * @param options - Per-request overrides (mode, risk, debug, playerId, timeout, …).
   *
   * @example
   * ```typescript
   * // Shorthand
   * const r1 = await client.moderate('I will k1ll you tonight');
   *
   * // Full request
   * const r2 = await client.moderate({
   *   input: 'I will k1ll you tonight',
   *   skipProfanity: false,
   *   longTextMode: true,
   * }, { risk: 'conservative', debug: true });
   * ```
   */
  async moderate(
    request: ModerationRequest | string,
    options?: ModerationOptions,
  ): Promise<ModerationResult> {
    const normalized: ModerationRequest =
      typeof request === 'string' ? { input: request } : request;

    const body = this.buildRequestBody(normalized);
    const response = await this.request<ApiResponse>(
      'POST',
      '/v1/moderation',
      body,
      options,
    );

    return this.transformResponse(response);
  }

  /**
   * Moderate multiple items sequentially.
   *
   * @example
   * ```typescript
   * const batch = await client.moderateBatch([
   *   { input: 'Message 1' },
   *   'Message 2',
   *   { input: 'Message 3', skipProfanity: true },
   * ]);
   * console.log(batch.blockedCount);
   * ```
   */
  async moderateBatch(
    items: Array<ModerationRequest | string>,
    options?: ModerationOptions,
  ): Promise<BatchModerationResult> {
    const results: ModerationResult[] = [];
    const errors: Array<{ index: number; error: string; code?: string }> = [];

    for (let i = 0; i < items.length; i++) {
      try {
        results.push(await this.moderate(items[i], options));
      } catch (error) {
        const err = error instanceof ModeryoError ? error : new ModeryoError(String(error));
        errors.push({ index: i, error: err.message, code: err.code });
      }
    }

    return {
      total: items.length,
      successful: results.length,
      failed: errors.length,
      flaggedCount: results.filter((r) => r.flagged).length,
      blockedCount: results.filter((r) => r.action === 'block').length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Quick health check — returns `true` when the API is reachable.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request('GET', '/health');
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Request body builder
  // ---------------------------------------------------------------------------

  private buildRequestBody(req: ModerationRequest): Record<string, unknown> {
    const body: Record<string, unknown> = {
      input: req.input,
      model: req.model ?? 'omni-moderation-latest',
    };

    if (req.longTextMode != null) body.long_text_mode = req.longTextMode;
    if (req.longTextThreshold != null) body.long_text_threshold = req.longTextThreshold;
    if (req.skipProfanity != null) body.skip_profanity = req.skipProfanity;
    if (req.skipThreat != null) body.skip_threat = req.skipThreat;
    if (req.skipMaskedWord != null) body.skip_masked_word = req.skipMaskedWord;

    return body;
  }

  // ---------------------------------------------------------------------------
  // HTTP transport
  // ---------------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    options?: ModerationOptions,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const timeout = options?.timeout ?? this.timeout;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      'User-Agent': `moderyo-sdk-js/${SDK_VERSION}`,
      'X-SDK-Version': SDK_VERSION,
      ...this.headers,
      ...options?.headers,
    };

    // Map ModerationOptions → custom headers
    if (options?.mode) headers['X-Moderyo-Mode'] = options.mode;
    if (options?.risk) headers['X-Moderyo-Risk'] = options.risk;
    if (options?.debug) headers['X-Moderyo-Debug'] = 'true';
    if (options?.playerId) headers['X-Moderyo-Player-Id'] = options.playerId;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= (options?.noRetry ? 0 : this.maxRetries); attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        if (options?.signal) {
          options.signal.addEventListener('abort', () => controller.abort());
        }

        try {
          const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // Rate-limit handling
          if (response.status === 429) {
            const rlError = this.handleRateLimitResponse(response);
            this.onRateLimit?.({
              limit: rlError.limit,
              remaining: rlError.remaining,
              reset: rlError.reset,
              retryAfter: rlError.retryAfter,
            });
            if (attempt < this.maxRetries && !options?.noRetry) {
              await this.sleep(rlError.retryAfter);
              continue;
            }
            throw rlError;
          }

          if (!response.ok) throw await this.handleErrorResponse(response);
          return (await response.json()) as T;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) {
          const isTimeout = error.name === 'AbortError';
          lastError = new NetworkError(
            isTimeout ? 'Request timeout' : 'Network error',
            { timeout: isTimeout, cause: error instanceof Error ? error : undefined },
          );
        }

        if (attempt < this.maxRetries && !options?.noRetry && isRetryableError(lastError)) {
          await this.sleep(this.retryDelay * Math.pow(2, attempt));
          continue;
        }

        this.onError?.(lastError);
        throw lastError;
      }
    }

    throw lastError ?? new ModeryoError('Request failed');
  }

  // ---------------------------------------------------------------------------
  // Response transformer
  // ---------------------------------------------------------------------------

  private transformResponse(raw: ApiResponse): ModerationResult {
    const first = raw.results?.[0];

    return {
      id: raw.id ?? this.generateId(),
      model: raw.model ?? 'omni-moderation-latest',
      flagged: first?.flagged ?? false,
      action: (raw.action ?? 'allow') as 'allow' | 'flag' | 'block',
      categories: this.normalizeCategories(first?.categories),
      categoryScores: this.normalizeScores(first?.category_scores),
      scores: this.normalizeSimplifiedScores(raw.scores),
      policyDecision: raw.policy_decision ? this.transformPolicyDecision(raw.policy_decision) : undefined,
      detectedPhrases: raw.detected_phrases?.map((p) => ({ text: p.text, label: p.label })),
      mode: raw.mode as ModerationResult['mode'],
      risk: raw.risk as ModerationResult['risk'],
      safetyScore: raw.safety_score ?? undefined,
      longTextAnalysis: first?.long_text_analysis
        ? this.transformLongTextAnalysis(first.long_text_analysis)
        : undefined,
      abuseSignals: raw.abuse_signals ?? undefined,
      shadowDecision: raw.shadow_decision ?? undefined,
    };
  }

  private transformPolicyDecision(pd: ApiPolicyDecision): PolicyDecision {
    return {
      decision: pd.decision as PolicyDecision['decision'],
      ruleId: pd.rule_id ?? '',
      ruleName: pd.rule_name ?? '',
      reason: pd.reason ?? '',
      confidence: pd.confidence ?? 0,
      severity: (pd.severity ?? 'low') as PolicyDecision['severity'],
      triggeredRule: pd.triggered_rule
        ? {
            id: pd.triggered_rule.id,
            type: pd.triggered_rule.type,
            category: pd.triggered_rule.category,
            threshold: pd.triggered_rule.threshold,
            actualValue: pd.triggered_rule.actual_value,
            matched: pd.triggered_rule.matched,
          }
        : undefined,
      highlights: pd.highlights?.map((h) => ({
        text: h.text,
        category: h.category,
        startIndex: h.start_index,
        endIndex: h.end_index,
      })),
    };
  }

  private transformLongTextAnalysis(lta: ApiLongTextAnalysis): LongTextAnalysis {
    return {
      overallToxicity: lta.overall_toxicity,
      maxToxicity: lta.max_toxicity,
      top3MeanToxicity: lta.top3_mean_toxicity,
      decisionConfidence: lta.decision_confidence,
      signalConfidence: lta.signal_confidence,
      sentences: (lta.sentences ?? []).map((s) => ({
        index: s.index,
        text: s.text,
        start: s.start,
        end: s.end,
        charCount: s.char_count,
        toxicity: s.toxicity,
        decision: s.decision,
      })),
      highlights: (lta.highlights ?? []).map((h) => ({
        text: h.text,
        start: h.start,
        end: h.end,
        score: h.score,
        source: h.source,
        basis: h.basis,
      })),
      processing: {
        mode: lta.processing?.mode ?? '',
        originalCharCount: lta.processing?.original_char_count ?? 0,
        processedCharCount: lta.processing?.processed_char_count ?? 0,
        originalSentenceCount: lta.processing?.original_sentence_count ?? 0,
        finalSentenceCount: lta.processing?.final_sentence_count ?? 0,
        truncated: lta.processing?.truncated ?? false,
        truncationReason: lta.processing?.truncation_reason ?? null,
        inferenceTimeMs: lta.processing?.inference_time_ms ?? 0,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Normalizers
  // ---------------------------------------------------------------------------

  private normalizeCategories(raw: Record<string, boolean> = {}): Categories {
    const out: Record<string, boolean> = {};
    for (const key of ALL_CATEGORIES) out[key] = false;
    return { ...out, ...raw } as Categories;
  }

  private normalizeScores(raw: Record<string, number> = {}): CategoryScores {
    const out: Record<string, number> = {};
    for (const key of ALL_CATEGORIES) out[key] = 0;
    return { ...out, ...raw } as CategoryScores;
  }

  private normalizeSimplifiedScores(raw?: Record<string, number>): SimplifiedScores {
    return {
      toxicity: raw?.toxicity ?? 0,
      hate: raw?.hate ?? 0,
      harassment: raw?.harassment ?? 0,
      scam: raw?.scam ?? 0,
      violence: raw?.violence ?? 0,
      fraud: raw?.fraud ?? 0,
      ...raw,
    };
  }

  // ---------------------------------------------------------------------------
  // Error helpers
  // ---------------------------------------------------------------------------

  private handleRateLimitResponse(response: Response): RateLimitError {
    const retryAfter = parseInt(response.headers.get('Retry-After') ?? '60', 10) * 1000;
    const limit = parseInt(response.headers.get('X-RateLimit-Limit') ?? '0', 10);
    const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') ?? '0', 10);
    const resetTs = parseInt(response.headers.get('X-RateLimit-Reset') ?? '0', 10);
    return new RateLimitError('Rate limit exceeded', {
      retryAfter,
      limit,
      remaining,
      reset: new Date(resetTs * 1000),
    });
  }

  private async handleErrorResponse(response: Response): Promise<ModeryoError> {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text().catch(() => null);
    }

    const requestId = response.headers.get('X-Request-ID') ?? undefined;
    const message = this.extractErrorMessage(body, response.statusText);

    switch (response.status) {
      case 400:
        return new ValidationError(message, { requestId });
      case 401:
        return new AuthenticationError(message, { requestId });
      case 402:
        return new QuotaExceededError(message, { currentUsage: 0, limit: 0, requestId });
      case 429:
        return new RateLimitError(message, { retryAfter: 60_000, requestId });
      default:
        return new APIError(message, { statusCode: response.status, response: body, requestId });
    }
  }

  private extractErrorMessage(body: unknown, fallback: string): string {
    if (body && typeof body === 'object') {
      const obj = body as Record<string, unknown>;
      if (typeof obj.message === 'string') return obj.message;
      if (typeof obj.error === 'string') return obj.error;
      if (obj.error && typeof obj.error === 'object') {
        const inner = obj.error as Record<string, unknown>;
        if (typeof inner.message === 'string') return inner.message;
      }
    }
    return fallback;
  }

  // ---------------------------------------------------------------------------
  // Misc
  // ---------------------------------------------------------------------------

  private generateId(): string {
    return `modr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Internal API response types (snake_case from server)
// =============================================================================

interface ApiResponse {
  id?: string;
  model?: string;
  results?: Array<{
    flagged?: boolean;
    categories?: Record<string, boolean>;
    category_scores?: Record<string, number>;
    long_text_analysis?: ApiLongTextAnalysis;
  }>;
  action?: string;
  mode?: string;
  risk?: string;
  safety_score?: number;
  scores?: Record<string, number>;
  policy_decision?: ApiPolicyDecision;
  detected_phrases?: Array<{ text: string; label: string }>;
  abuse_signals?: Record<string, unknown>;
  shadow_decision?: Record<string, unknown>;
}

interface ApiPolicyDecision {
  decision: string;
  rule_id?: string;
  rule_name?: string;
  reason?: string;
  confidence?: number;
  severity?: string;
  triggered_rule?: {
    id: string;
    type: string;
    category: string;
    threshold: number;
    actual_value: number;
    matched: boolean;
  };
  highlights?: Array<{
    text: string;
    category: string;
    start_index: number;
    end_index: number;
  }>;
}

interface ApiLongTextAnalysis {
  overall_toxicity: number;
  max_toxicity: number;
  top3_mean_toxicity: number;
  decision_confidence: number;
  signal_confidence: number;
  sentences?: Array<{
    index: number;
    text: string;
    start: number;
    end: number;
    char_count: number;
    toxicity: number;
    decision: string;
  }>;
  highlights?: Array<{
    text: string;
    start: number;
    end: number;
    score: number;
    source: string;
    basis: string;
  }>;
  processing?: {
    mode: string;
    original_char_count: number;
    processed_char_count: number;
    original_sentence_count: number;
    final_sentence_count: number;
    truncated: boolean;
    truncation_reason: string | null;
    inference_time_ms: number;
  };
}
