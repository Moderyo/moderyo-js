/**
 * Moderyo Express.js Middleware
 *
 * Plug-and-play content moderation for Express applications.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { Moderyo } from '../client.js';
import type { ModeryoConfig, ModerationResult } from '../types.js';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      moderation?: ModerationResult;
      moderyo?: Moderyo;
    }
  }
}

export interface ModeryoMiddlewareOptions extends ModeryoConfig {
  /** Paths to skip moderation on */
  skipPaths?: string[];
}

export interface ModerateOptions {
  /** Dot-notated path to the field to moderate, e.g. 'body.message' */
  field: string;
  /** Block request when content is flagged @default false */
  blockOnFlag?: boolean;
  /** Block request when action is 'block' @default true */
  blockOnBlock?: boolean;
  /** Custom handler when content is blocked */
  onBlock?: (req: Request, res: Response, result: ModerationResult) => void;
}

/**
 * Create a Moderyo middleware instance.
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createModeryoMiddleware } from '@moderyo/sdk/express';
 *
 * const app = express();
 * const moderyo = createModeryoMiddleware({
 *   apiKey: process.env.MODERYO_API_KEY!,
 * });
 *
 * app.use(moderyo.client());
 *
 * app.post('/api/messages',
 *   moderyo.moderate({ field: 'body.message' }),
 *   (req, res) => {
 *     res.json({ status: 'ok', action: req.moderation?.action });
 *   },
 * );
 * ```
 */
export function createModeryoMiddleware(options: ModeryoMiddlewareOptions) {
  const moderyo = new Moderyo(options);

  return {
    getClient: () => moderyo,

    /** Attach the Moderyo client to `req.moderyo` */
    client: (): RequestHandler => {
      return (req: Request, _res: Response, next: NextFunction) => {
        req.moderyo = moderyo;
        next();
      };
    },

    /** Moderate content in a specific request field */
    moderate: (opts: ModerateOptions): RequestHandler => {
      const blockOnBlock = opts.blockOnBlock ?? true;
      const blockOnFlag = opts.blockOnFlag ?? false;

      return async (req: Request, res: Response, next: NextFunction) => {
        try {
          if (options.skipPaths?.includes(req.path)) return next();

          const text = getNestedValue(req, opts.field);
          if (!text || typeof text !== 'string') return next();

          const result = await moderyo.moderate(
            { input: text },
            { playerId: (req as Request & { user?: { id?: string } }).user?.id },
          );

          req.moderation = result;

          const shouldBlock =
            (blockOnBlock && result.action === 'block') ||
            (blockOnFlag && result.flagged);

          if (shouldBlock) {
            if (opts.onBlock) return opts.onBlock(req, res, result);
            return res.status(400).json({
              error: 'Content blocked by moderation',
              reason: result.policyDecision?.reason,
              action: result.action,
            });
          }

          next();
        } catch (error) {
          next(error);
        }
      };
    },

    /** Auto-moderate common fields (body.content, body.message, body.text) */
    auto: (opts?: Partial<ModerateOptions>): RequestHandler => {
      const fields = ['body.content', 'body.message', 'body.text', 'body.body'];

      return async (req: Request, res: Response, next: NextFunction) => {
        try {
          if (options.skipPaths?.includes(req.path)) return next();

          let text: string | undefined;
          for (const field of fields) {
            const val = getNestedValue(req, field);
            if (val && typeof val === 'string') {
              text = val;
              break;
            }
          }
          if (!text) return next();

          const result = await moderyo.moderate({ input: text });
          req.moderation = result;

          if (result.action === 'block' && opts?.blockOnBlock !== false) {
            if (opts?.onBlock) return opts.onBlock(req, res, result);
            return res.status(400).json({
              error: 'Content blocked by moderation',
              action: result.action,
            });
          }
          next();
        } catch (error) {
          next(error);
        }
      };
    },
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

export default createModeryoMiddleware;
