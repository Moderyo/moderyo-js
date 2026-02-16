/**
 * Moderyo SDK — Playground Examples
 *
 * Demonstrates every feature of the TypeScript / Node.js SDK.
 * Run: npx tsx examples/playground.ts
 */

import {
  Moderyo,
  ModeryoError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  type ModerationResult,
  type Decision,
} from '@moderyo/sdk';

// =============================================================================
// 1 · Basic moderation
// =============================================================================

async function basic() {
  const client = new Moderyo({ apiKey: process.env.MODERYO_API_KEY! });

  // Shorthand — just pass a string
  const r1 = await client.moderate('Hello, this is a friendly message!');
  console.log('=== 1. Basic ===');
  console.log('Action:', r1.action); // 'allow'
  console.log('Flagged:', r1.flagged);
  console.log('');

  // Full request with every toggle
  const r2 = await client.moderate({
    input: 'Great product, highly recommend!',
    skipProfanity: false,
    skipThreat: false,
    skipMaskedWord: false,
  });
  console.log('Action:', r2.action);
  console.log('');
}

// =============================================================================
// 2 · Harmful content + scores
// =============================================================================

async function harmful() {
  const client = new Moderyo({ apiKey: process.env.MODERYO_API_KEY! });

  const result = await client.moderate({
    input: 'I will k1ll you tonight',
  });

  console.log('=== 2. Harmful Content ===');
  console.log('Decision:', result.action);
  console.log('Safety score:', result.safetyScore);

  // Simplified aggregate scores (0-1)
  console.log('Scores:', {
    toxicity: result.scores.toxicity,
    violence: result.scores.violence,
    hate: result.scores.hate,
  });

  // Detailed per-category scores (27 categories)
  const triggered = Object.entries(result.categoryScores)
    .filter(([, v]) => v > 0.3)
    .map(([k, v]) => `${k}: ${(v * 100).toFixed(0)}%`);
  console.log('Triggered categories:', triggered.join(', ') || 'none');
  console.log('');
}

// =============================================================================
// 3 · Policy decision & detected phrases
// =============================================================================

async function policyDecision() {
  const client = new Moderyo({ apiKey: process.env.MODERYO_API_KEY! });

  const result = await client.moderate({
    input: 'Send bitcoin to claim your sp3cial pr1ze now!',
  });

  console.log('=== 3. Policy Decision ===');
  console.log('Action:', result.action);

  if (result.policyDecision) {
    const pd = result.policyDecision;
    console.log('Rule:', pd.ruleName, `(${pd.ruleId})`);
    console.log('Reason:', pd.reason);
    console.log('Confidence:', pd.confidence + '%');
    console.log('Severity:', pd.severity);

    if (pd.triggeredRule) {
      console.log('Triggered rule detail:', {
        type: pd.triggeredRule.type,
        category: pd.triggeredRule.category,
        threshold: pd.triggeredRule.threshold,
        actual: pd.triggeredRule.actualValue,
      });
    }

    if (pd.highlights?.length) {
      console.log('Highlights:', pd.highlights.map((h) => h.text).join(', '));
    }
  }

  if (result.detectedPhrases?.length) {
    console.log(
      'Detected phrases:',
      result.detectedPhrases.map((p) => `"${p.text}" (${p.label})`).join(', '),
    );
  }
  console.log('');
}

// =============================================================================
// 4 · Long-text mode
// =============================================================================

async function longText() {
  const client = new Moderyo({ apiKey: process.env.MODERYO_API_KEY! });

  const paragraph = `
    This is a perfectly normal review about a restaurant. The food was great
    and the staff was very friendly. However, the customer next to us was
    extremely rude and said terrible things. He threatened to hurt the waiter
    if his order wasn't fixed immediately. Despite that incident, we had a
    wonderful evening and will definitely come back.
  `.trim();

  const result = await client.moderate({
    input: paragraph,
    longTextMode: true,
    longTextThreshold: 100,
  });

  console.log('=== 4. Long-Text Analysis ===');
  console.log('Action:', result.action);

  if (result.longTextAnalysis) {
    const lta = result.longTextAnalysis;
    console.log('Overall toxicity:', lta.overallToxicity.toFixed(3));
    console.log('Max toxicity:', lta.maxToxicity.toFixed(3));
    console.log('Top-3 mean:', lta.top3MeanToxicity.toFixed(3));
    console.log(`Sentences: ${lta.sentences.length}`);

    for (const s of lta.sentences) {
      const icon = s.toxicity > 0.5 ? '🚨' : s.toxicity > 0.2 ? '⚠️' : '✅';
      console.log(`  ${icon} [${s.index}] toxicity=${s.toxicity.toFixed(2)} → ${s.decision}`);
    }

    console.log('Processing:', {
      mode: lta.processing.mode,
      truncated: lta.processing.truncated,
      inferenceMs: lta.processing.inferenceTimeMs,
    });
  }
  console.log('');
}

// =============================================================================
// 5 · Toggle flags (skip profanity / threat / masked-word)
// =============================================================================

async function toggles() {
  const client = new Moderyo({ apiKey: process.env.MODERYO_API_KEY! });

  const text = 'You are a f*cking idiot and I will find you';

  // All detections enabled (default)
  const r1 = await client.moderate({ input: text });

  // Profanity + threat detection disabled
  const r2 = await client.moderate({
    input: text,
    skipProfanity: true,
    skipThreat: true,
  });

  console.log('=== 5. Toggle Flags ===');
  console.log('All enabled  →', r1.action, '| phrases:', r1.detectedPhrases?.length ?? 0);
  console.log('Skip prof+threat →', r2.action, '| phrases:', r2.detectedPhrases?.length ?? 0);
  console.log('');
}

// =============================================================================
// 6 · Mode & risk headers
// =============================================================================

async function modeAndRisk() {
  const client = new Moderyo({ apiKey: process.env.MODERYO_API_KEY! });

  // Shadow mode — logs decision without enforcement
  const r1 = await client.moderate(
    { input: 'Borderline message that might be rude' },
    { mode: 'shadow', risk: 'conservative' },
  );

  console.log('=== 6. Mode & Risk ===');
  console.log('Mode:', r1.mode);
  console.log('Risk:', r1.risk);
  console.log('Action:', r1.action);
  if (r1.shadowDecision) console.log('Shadow decision:', r1.shadowDecision);
  console.log('');
}

// =============================================================================
// 7 · Debug mode (abuse signals)
// =============================================================================

async function debugMode() {
  const client = new Moderyo({ apiKey: process.env.MODERYO_API_KEY! });

  const result = await client.moderate(
    { input: 'Win a free iPhone — click here: http://scam.example.com' },
    { debug: true },
  );

  console.log('=== 7. Debug Mode ===');
  console.log('Action:', result.action);
  if (result.abuseSignals) {
    console.log('Abuse signals:', JSON.stringify(result.abuseSignals, null, 2));
  }
  console.log('');
}

// =============================================================================
// 8 · Batch processing
// =============================================================================

async function batch() {
  const client = new Moderyo({ apiKey: process.env.MODERYO_API_KEY! });

  const messages = [
    'Hello everyone!',
    'This is a normal message',
    'I hate everyone in this group!',
    "Let's meet for coffee",
    'Kill all the enemies in the game',
  ];

  const results = await client.moderateBatch(messages.map((m) => ({ input: m })));

  console.log('=== 8. Batch ===');
  console.log(`Total: ${results.total} | Flagged: ${results.flaggedCount} | Blocked: ${results.blockedCount}`);

  results.results.forEach((r, i) => {
    const icon = r.action === 'block' ? '🚫' : r.flagged ? '⚠️' : '✅';
    console.log(`  ${icon} "${messages[i]}" → ${r.action}`);
  });
  console.log('');
}

// =============================================================================
// 9 · Error handling
// =============================================================================

async function errorHandling() {
  console.log('=== 9. Error Handling ===');

  const client = new Moderyo({ apiKey: 'invalid_key' });

  try {
    await client.moderate({ input: 'test' });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.log('Auth failed:', error.message, '| status:', error.statusCode);
    } else if (error instanceof RateLimitError) {
      console.log('Rate limited — retry after', error.retryAfter, 'ms');
    } else if (error instanceof ValidationError) {
      console.log('Validation:', error.message, '| field:', error.field);
    } else if (error instanceof ModeryoError) {
      console.log('SDK error:', error.code, error.message);
    } else {
      console.log('Unknown:', error);
    }
  }
  console.log('');
}

// =============================================================================
// 10 · Player tracking (gaming use-case)
// =============================================================================

async function gaming() {
  const client = new Moderyo({ apiKey: process.env.MODERYO_API_KEY! });

  const chat = [
    { playerId: 'player_1', msg: 'gg wp!' },
    { playerId: 'player_2', msg: 'noob team, uninstall' },
    { playerId: 'player_3', msg: "Let's push mid together" },
    { playerId: 'player_4', msg: "I'll kill you IRL" },
  ];

  console.log('=== 10. Gaming Chat ===');

  for (const { playerId, msg } of chat) {
    const result = await client.moderate(
      { input: msg },
      { playerId, risk: 'conservative' },
    );

    const icon = result.action === 'block' ? '🚫' : result.action === 'flag' ? '⚠️' : '✅';
    console.log(`${icon} [${playerId}]: "${msg}" → ${result.action}`);

    if (result.action !== 'allow' && result.policyDecision) {
      console.log(`   Rule: ${result.policyDecision.ruleName} (${result.policyDecision.severity})`);
    }
  }
  console.log('');
}

// =============================================================================
// 11 · TypeScript strong typing
// =============================================================================

async function typescriptTypes() {
  const client = new Moderyo({ apiKey: process.env.MODERYO_API_KEY! });

  const result: ModerationResult = await client.moderate({ input: 'Hello!' });
  const action: Decision = result.action;

  // All 27 categories are typed
  const hasViolence: boolean = result.categories.violence;
  const violenceScore: number = result.categoryScores.violence;
  const hasChildGrooming: boolean = result.categories.child_grooming;
  const extremism: number = result.categoryScores.extremism_propaganda;

  console.log('=== 11. TypeScript Types ===');
  console.log('Action (typed):', action);
  console.log('violence:', hasViolence, violenceScore);
  console.log('child_grooming:', hasChildGrooming);
  console.log('extremism_propaganda:', extremism);
  console.log('');
}

// =============================================================================
// 12 · Custom config + health check
// =============================================================================

async function customConfig() {
  const client = new Moderyo({
    apiKey: process.env.MODERYO_API_KEY!,
    baseUrl: 'https://api.moderyo.com',
    timeout: 15_000,
    maxRetries: 5,
    retryDelay: 2_000,
    onError: (err) => console.error('[Moderyo Error]', err.message),
    onRateLimit: (info) => console.warn('[Rate Limit]', info),
  });

  const ok = await client.healthCheck();
  console.log('=== 12. Health Check ===');
  console.log('API healthy:', ok ? 'YES' : 'NO');
  console.log('');
}

// =============================================================================
// Run all
// =============================================================================

async function main() {
  console.log('Moderyo SDK — Playground Examples\n' + '='.repeat(50) + '\n');

  await basic();
  await harmful();
  await policyDecision();
  await longText();
  await toggles();
  await modeAndRisk();
  await debugMode();
  await batch();
  await errorHandling();
  await gaming();
  await typescriptTypes();
  await customConfig();
}

main().catch(console.error);
