/**
 * Moderyo Fastify Plugin
 *
 * Plug-and-play content moderation for Fastify applications.
 */

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from 'fastify';
import { Moderyo } from '../client.js';
import type { ModeryoConfig, ModerationResult } from '../types.js';

declare module 'fastify' {
  interface FastifyRequest {
    moderation?: ModerationResult;
    moderyo: Moderyo;
  }
  interface FastifyInstance {
    moderyo: Moderyo;
  }
}

export interface ModeryoPluginOptions extends ModeryoConfig {
  skipPaths?: string[];
  decorateInstance?: boolean;
  decorateRequest?: boolean;
}

/**
 * Fastify plugin for Moderyo.
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { moderyoPlugin } from '@moderyo/sdk/fastify';
 *
 * const fastify = Fastify();
 *
 * fastify.register(moderyoPlugin, {
 *   apiKey: process.env.MODERYO_API_KEY!,
 * });
 *
 * fastify.post('/api/messages', async (request, reply) => {
 *   const result = await request.moderyo.moderate({
 *     input: (request.body as any).message,
 *   });
 *   if (result.action === 'block') {
 *     return reply.status(400).send({ error: 'Blocked' });
 *   }
 *   return { status: 'ok' };
 * });
 * ```
 */
export const moderyoPlugin: FastifyPluginAsync<ModeryoPluginOptions> = async (
  fastify: FastifyInstance,
  options: ModeryoPluginOptions,
) => {
  const moderyo = new Moderyo(options);

  if (options.decorateInstance !== false) {
    fastify.decorate('moderyo', moderyo);
  }

  if (options.decorateRequest !== false) {
    fastify.decorateRequest('moderyo', null as any);
    fastify.decorateRequest('moderation', null as any);
    fastify.addHook('onRequest', async (request: FastifyRequest) => {
      request.moderyo = moderyo;
    });
  }
};

/**
 * Create a preHandler hook for automatic moderation.
 */
export function createModerationHook(options: {
  client: Moderyo;
  field: string;
  blockOnBlock?: boolean;
  blockOnFlag?: boolean;
  onBlock?: (request: FastifyRequest, reply: FastifyReply, result: ModerationResult) => void;
}) {
  const blockOnBlock = options.blockOnBlock ?? true;
  const blockOnFlag = options.blockOnFlag ?? false;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const text = getNestedValue(request, options.field);
    if (!text || typeof text !== 'string') return;

    const result = await options.client.moderate({ input: text });
    request.moderation = result;

    const shouldBlock =
      (blockOnBlock && result.action === 'block') ||
      (blockOnFlag && result.flagged);

    if (shouldBlock) {
      if (options.onBlock) return options.onBlock(request, reply, result);
      return reply.status(400).send({
        error: 'Content blocked by moderation',
        reason: result.policyDecision?.reason,
        action: result.action,
      });
    }
  };
}

function getNestedValue(obj: unknown, path: string): unknown {
  let current: unknown = obj;
  for (const key of path.split('.')) {
    if (current == null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export default moderyoPlugin;
