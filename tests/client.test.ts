/**
 * Moderyo SDK Client Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Moderyo } from '../src/client';
import {
  AuthenticationError,
  RateLimitError,
  ValidationError,
  APIError,
  NetworkError,
} from '../src/errors';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Moderyo Client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw ValidationError when apiKey is missing', () => {
      expect(() => new Moderyo({ apiKey: '' })).toThrow(ValidationError);
    });

    it('should create client with valid apiKey', () => {
      const client = new Moderyo({ apiKey: 'test-key' });
      expect(client).toBeInstanceOf(Moderyo);
    });

    it('should use default baseUrl', () => {
      const client = new Moderyo({ apiKey: 'test-key' });
      expect(client).toBeDefined();
    });

    it('should accept custom baseUrl', () => {
      const client = new Moderyo({
        apiKey: 'test-key',
        baseUrl: 'https://custom.api.com',
      });
      expect(client).toBeDefined();
    });
  });

  describe('moderate', () => {
    it('should moderate content successfully', async () => {
      const client = new Moderyo({ apiKey: 'test-key' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'modr-123',
          model: 'omni-moderation-latest',
          results: [{
            flagged: false,
            categories: { violence: false, harassment: false },
            category_scores: { violence: 0.01, harassment: 0.02 },
          }],
          action: 'allow',
        }),
      });

      const result = await client.moderate({ content: 'Hello, world!' });

      expect(result).toBeDefined();
      expect(result.id).toBe('modr-123');
      expect(result.flagged).toBe(false);
      expect(result.action).toBe('allow');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should accept string content directly', async () => {
      const client = new Moderyo({ apiKey: 'test-key' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'modr-124',
          results: [{ flagged: false, categories: {}, category_scores: {} }],
          action: 'allow',
        }),
      });

      const result = await client.moderate('Hello!');

      expect(result.action).toBe('allow');
    });

    it('should handle flagged content', async () => {
      const client = new Moderyo({ apiKey: 'test-key' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'modr-125',
          results: [{
            flagged: true,
            categories: { violence: true, 'violence/threat': true },
            category_scores: { violence: 0.95, 'violence/threat': 0.88 },
          }],
          action: 'block',
          explanation: 'Content contains violent threats',
        }),
      });

      const result = await client.moderate({ content: 'Harmful content' });

      expect(result.flagged).toBe(true);
      expect(result.action).toBe('block');
      expect(result.categories.violence).toBe(true);
      expect(result.scores.violence).toBeGreaterThan(0.9);
    });

    it('should include context in request', async () => {
      const client = new Moderyo({ apiKey: 'test-key' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'modr-126',
          results: [{ flagged: false, categories: {}, category_scores: {} }],
          action: 'allow',
        }),
      });

      await client.moderate({
        content: 'Test',
        context: {
          userId: 'user_123',
          contentType: 'chat',
        },
      });

      const [, fetchOptions] = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchOptions.body);
      expect(body.metadata).toEqual({
        userId: 'user_123',
        contentType: 'chat',
      });
    });
  });

  describe('error handling', () => {
    it('should throw AuthenticationError on 401', async () => {
      const client = new Moderyo({ apiKey: 'invalid-key' });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers(),
        json: async () => ({ error: 'Invalid API key' }),
      });

      await expect(client.moderate({ content: 'test' }))
        .rejects.toThrow(AuthenticationError);
    });

    it('should throw RateLimitError on 429', async () => {
      const client = new Moderyo({
        apiKey: 'test-key',
        maxRetries: 0,
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({
          'Retry-After': '60',
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
        }),
        json: async () => ({ error: 'Rate limit exceeded' }),
      });

      await expect(client.moderate({ content: 'test' }))
        .rejects.toThrow(RateLimitError);
    });

    it('should throw ValidationError on 400', async () => {
      const client = new Moderyo({ apiKey: 'test-key' });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers(),
        json: async () => ({ error: 'Invalid request format' }),
      });

      await expect(client.moderate({ content: 'test' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw APIError on 500', async () => {
      const client = new Moderyo({
        apiKey: 'test-key',
        maxRetries: 0,
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers(),
        json: async () => ({ error: 'Server error' }),
      });

      await expect(client.moderate({ content: 'test' }))
        .rejects.toThrow(APIError);
    });
  });

  describe('moderateBatch', () => {
    it('should process multiple items', async () => {
      const client = new Moderyo({ apiKey: 'test-key' });

      // Mock 3 successful responses
      for (let i = 0; i < 3; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            id: `modr-${i}`,
            results: [{ flagged: i === 2, categories: {}, category_scores: {} }],
            action: i === 2 ? 'block' : 'allow',
          }),
        });
      }

      const results = await client.moderateBatch([
        { content: 'Message 1' },
        { content: 'Message 2' },
        { content: 'Bad message' },
      ]);

      expect(results.total).toBe(3);
      expect(results.successful).toBe(3);
      expect(results.failed).toBe(0);
      expect(results.flaggedCount).toBe(1);
      expect(results.blockedCount).toBe(1);
    });

    it('should handle partial failures', async () => {
      const client = new Moderyo({
        apiKey: 'test-key',
        maxRetries: 0,
      });

      // First succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'modr-1',
          results: [{ flagged: false, categories: {}, category_scores: {} }],
          action: 'allow',
        }),
      });

      // Second fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        headers: new Headers(),
        json: async () => ({ error: 'Server error' }),
      });

      // Third succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'modr-3',
          results: [{ flagged: false, categories: {}, category_scores: {} }],
          action: 'allow',
        }),
      });

      const results = await client.moderateBatch([
        { content: 'Message 1' },
        { content: 'Message 2' },
        { content: 'Message 3' },
      ]);

      expect(results.total).toBe(3);
      expect(results.successful).toBe(2);
      expect(results.failed).toBe(1);
      expect(results.errors).toHaveLength(1);
      expect(results.errors![0].index).toBe(1);
    });
  });

  describe('retries', () => {
    it('should retry on 500 errors', async () => {
      const client = new Moderyo({
        apiKey: 'test-key',
        maxRetries: 2,
        retryDelay: 10, // Fast for tests
      });

      // First two fail, third succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Server Error',
          headers: new Headers(),
          json: async () => ({ error: 'Server error' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Server Error',
          headers: new Headers(),
          json: async () => ({ error: 'Server error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'modr-success',
            results: [{ flagged: false, categories: {}, category_scores: {} }],
            action: 'allow',
          }),
        });

      const result = await client.moderate({ content: 'test' });

      expect(result.id).toBe('modr-success');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on 401 errors', async () => {
      const client = new Moderyo({
        apiKey: 'test-key',
        maxRetries: 3,
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers(),
        json: async () => ({ error: 'Invalid API key' }),
      });

      await expect(client.moderate({ content: 'test' }))
        .rejects.toThrow(AuthenticationError);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('healthCheck', () => {
    it('should return true when API is healthy', async () => {
      const client = new Moderyo({ apiKey: 'test-key' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' }),
      });

      const result = await client.healthCheck();
      expect(result).toBe(true);
    });

    it('should return false when API is unhealthy', async () => {
      const client = new Moderyo({ apiKey: 'test-key' });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.healthCheck();
      expect(result).toBe(false);
    });
  });
});
