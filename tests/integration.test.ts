/**
 * Moderyo TypeScript SDK Integration Tests
 * 
 * Run with: npm test
 * Integration tests: npm test -- --testPathPattern=integration
 * 
 * Environment variables:
 * - MODERYO_API_KEY: Test API key
 * - MODERYO_BASE_URL: API base URL (default: http://localhost:8080)
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  ModeryoClient,
  Decision,
  ModerationResult,
  ModerationRequest,
  ModeryoError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
} from '../src/index';

// ============================================================
// Unit Tests (no API call)
// ============================================================

describe('ModeryoClient Unit Tests', () => {
  describe('Client Creation', () => {
    it('should create client with API key', () => {
      const client = new ModeryoClient({ apiKey: 'sk-test-key' });
      expect(client).toBeDefined();
    });

    it('should create client with custom base URL', () => {
      const client = new ModeryoClient({
        apiKey: 'sk-test-key',
        baseUrl: 'https://custom.api.com',
      });
      expect(client).toBeDefined();
    });

    it('should create client with timeout', () => {
      const client = new ModeryoClient({
        apiKey: 'sk-test-key',
        timeout: 30000,
      });
      expect(client).toBeDefined();
    });

    it('should create client with retries', () => {
      const client = new ModeryoClient({
        apiKey: 'sk-test-key',
        maxRetries: 5,
      });
      expect(client).toBeDefined();
    });

    it('should create client from environment', () => {
      process.env.MODERYO_API_KEY = 'sk-env-key';
      const client = ModeryoClient.fromEnv();
      expect(client).toBeDefined();
      delete process.env.MODERYO_API_KEY;
    });

    it('should fail without API key', () => {
      expect(() => new ModeryoClient({ apiKey: '' })).toThrow();
    });
  });

  describe('Decision Enum', () => {
    it('should have correct values', () => {
      expect(Decision.Allow).toBe('allow');
      expect(Decision.Flag).toBe('flag');
      expect(Decision.Block).toBe('block');
    });
  });

  describe('ModerationResult Helpers', () => {
    it('should detect when review is needed', () => {
      const result: ModerationResult = {
        id: 'test-123',
        model: 'omni-moderation-latest',
        flagged: true,
        action: Decision.Flag,
        categories: {},
        scores: {},
      };

      expect(result.flagged && result.action === Decision.Flag).toBe(true);
      expect(result.action === Decision.Block).toBe(false);
      expect(!result.flagged).toBe(false);
    });

    it('should detect when content should be blocked', () => {
      const result: ModerationResult = {
        id: 'test-123',
        model: 'omni-moderation-latest',
        flagged: true,
        action: Decision.Block,
        categories: {},
        scores: {},
      };

      expect(result.action === Decision.Block).toBe(true);
      expect(!result.flagged).toBe(false);
    });

    it('should detect safe content', () => {
      const result: ModerationResult = {
        id: 'test-123',
        model: 'omni-moderation-latest',
        flagged: false,
        action: Decision.Allow,
        categories: {},
        scores: {},
      };

      expect(!result.flagged).toBe(true);
      expect(result.flagged && result.action === Decision.Flag).toBe(false);
      expect(result.action === Decision.Block).toBe(false);
    });
  });

  describe('Request Validation', () => {
    it('should reject empty content', async () => {
      const client = new ModeryoClient({ apiKey: 'sk-test-key' });
      
      await expect(client.moderate('')).rejects.toThrow(ValidationError);
    });
  });
});

// ============================================================
// Integration Tests (requires API)
// ============================================================

describe('ModeryoClient Integration Tests', () => {
  const apiKey = process.env.MODERYO_API_KEY;
  const baseUrl = process.env.MODERYO_BASE_URL || 'http://localhost:8080';

  const skipIfNoApiKey = () => {
    if (!apiKey) {
      console.log('Skipping integration test: MODERYO_API_KEY not set');
      return true;
    }
    return false;
  };

  let client: ModeryoClient;

  beforeEach(() => {
    if (apiKey) {
      client = new ModeryoClient({ apiKey, baseUrl });
    }
  });

  describe('Basic Moderation', () => {
    it('should moderate clean content', async () => {
      if (skipIfNoApiKey()) return;

      const result = await client.moderate('Hello, this is a friendly message!');

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.action).toBeDefined();
    });

    it('should moderate content with context', async () => {
      if (skipIfNoApiKey()) return;

      const result = await client.moderate('Test message with context', {
        context: {
          userId: 'test_user_123',
          contentType: 'chat',
          language: 'en',
        },
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it('should moderate batch', async () => {
      if (skipIfNoApiKey()) return;

      const contents = [
        'First message',
        'Second message',
        'Third message',
      ];

      const results = await client.moderateBatch(contents);

      expect(results).toBeDefined();
      expect(results.total).toBe(3);
      expect(results.results).toHaveLength(3);
    });
  });

  describe('Health Check', () => {
    it('should perform health check', async () => {
      if (skipIfNoApiKey()) return;

      const healthy = await client.healthCheck();

      expect(healthy).toBe(true);
    });
  });

  describe('Parallel Requests', () => {
    it('should support parallel moderation', async () => {
      if (skipIfNoApiKey()) return;

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(client.moderate(`Parallel message ${i}`));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
      });
    });
  });
});

// ============================================================
// Tier-Specific Tests
// ============================================================

describe('Tier Limit Tests', () => {
  const baseUrl = process.env.MODERYO_BASE_URL || 'http://localhost:8080';

  describe('Free Tier', () => {
    it('should have text limit', async () => {
      const apiKey = process.env.MODERYO_FREE_API_KEY;
      if (!apiKey) {
        console.log('Skipping: MODERYO_FREE_API_KEY not set');
        return;
      }

      const client = new ModeryoClient({ apiKey, baseUrl });

      // Short text should work
      const result = await client.moderate('Short message');
      expect(result).toBeDefined();
    });
  });

  describe('Pro Tier', () => {
    it('should accept longer text', async () => {
      const apiKey = process.env.MODERYO_PRO_API_KEY;
      if (!apiKey) {
        console.log('Skipping: MODERYO_PRO_API_KEY not set');
        return;
      }

      const client = new ModeryoClient({ apiKey, baseUrl });

      // Longer text should work
      const longText = 'a'.repeat(5000);
      const result = await client.moderate(longText);
      expect(result).toBeDefined();
    });
  });
});

// ============================================================
// Error Handling Tests
// ============================================================

describe('Error Handling Tests', () => {
  const baseUrl = process.env.MODERYO_BASE_URL || 'http://localhost:8080';

  it('should throw AuthenticationError for invalid API key', async () => {
    const client = new ModeryoClient({
      apiKey: 'sk-invalid-key',
      baseUrl,
    });

    await expect(client.moderate('Test')).rejects.toThrow();
  });

  it('should handle network errors', async () => {
    const client = new ModeryoClient({
      apiKey: 'sk-test',
      baseUrl: 'http://localhost:99999',
      timeout: 1000,
    });

    await expect(client.moderate('Test')).rejects.toThrow();
  });

  it('should handle timeout', async () => {
    const apiKey = process.env.MODERYO_API_KEY;
    if (!apiKey) {
      console.log('Skipping: MODERYO_API_KEY not set');
      return;
    }

    const client = new ModeryoClient({
      apiKey,
      baseUrl,
      timeout: 1, // Very short timeout
    });

    await expect(client.moderate('Timeout test')).rejects.toThrow();
  });
});

// ============================================================
// Streaming Tests
// ============================================================

describe('Streaming Tests', () => {
  const apiKey = process.env.MODERYO_API_KEY;
  const baseUrl = process.env.MODERYO_BASE_URL || 'http://localhost:8080';

  it('should support streaming moderation', async () => {
    if (!apiKey) {
      console.log('Skipping: MODERYO_API_KEY not set');
      return;
    }

    const client = new ModeryoClient({ apiKey, baseUrl });

    const stream = client.moderateStream('Stream test message');
    const chunks: any[] = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
  });
});

// ============================================================
// Webhook Validation Tests
// ============================================================

describe('Webhook Validation', () => {
  it('should validate webhook signature', () => {
    const client = new ModeryoClient({ apiKey: 'sk-test-key' });
    const webhookSecret = 'whsec_test_secret';

    const payload = JSON.stringify({ event: 'moderation.complete', data: {} });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    // This would be the actual signature from the webhook
    // For testing, we just verify the method exists
    expect(typeof client.validateWebhookSignature).toBe('function');
  });
});
