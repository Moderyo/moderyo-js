# Moderyo TypeScript/Node.js SDK

Official TypeScript/Node.js client library for the Moderyo Content Moderation API.

[![npm version](https://badge.fury.io/js/@moderyo%2Fsdk.svg)](https://badge.fury.io/js/@moderyo%2Fsdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
npm install @moderyo/sdk
# or
yarn add @moderyo/sdk
# or
pnpm add @moderyo/sdk
```

## Quick Start

```typescript
import { Moderyo } from '@moderyo/sdk';

const client = new Moderyo({
  apiKey: process.env.MODERYO_API_KEY!,
});

// Moderate content
const result = await client.moderate({
  content: 'Hello, this is a test message',
});

console.log(result.flagged);  // true/false
console.log(result.action);   // 'allow' | 'flag' | 'block'
```

## Features

- ✅ Full TypeScript support with detailed type definitions
- ✅ Promise-based async API
- ✅ Automatic retry with exponential backoff
- ✅ Rate limiting handling
- ✅ Batch processing support
- ✅ Framework integrations (Express, Fastify, etc.)

## Configuration

```typescript
const client = new Moderyo({
  apiKey: process.env.MODERYO_API_KEY!,
  
  // Optional configuration
  baseUrl: 'https://api.moderyo.com',
  timeout: 30000,      // 30 seconds
  maxRetries: 3,
  retryDelay: 1000,    // Base delay for exponential backoff
  
  // Callbacks
  onError: (error) => console.error('Moderyo error:', error),
  onRateLimit: (info) => console.warn('Rate limited:', info),
});
```

## Error Handling

```typescript
import { 
  Moderyo, 
  ModeryoError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  APIError 
} from '@moderyo/sdk';

try {
  const result = await client.moderate({ content: text });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  } else if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter}ms`);
    await sleep(error.retryAfter);
    // Retry...
  } else if (error instanceof ValidationError) {
    console.error('Invalid request:', error.message);
  } else if (error instanceof APIError) {
    console.error(`API error ${error.statusCode}: ${error.message}`);
  }
}
```

## Batch Processing

```typescript
const results = await client.moderateBatch([
  { content: 'Message 1' },
  { content: 'Message 2' },
  { content: 'Message 3' },
]);

console.log(`Total: ${results.total}`);
console.log(`Flagged: ${results.flaggedCount}`);
console.log(`Blocked: ${results.blockedCount}`);

for (const result of results.results) {
  console.log(`${result.id}: ${result.action}`);
}
```

## Context & Metadata

```typescript
const result = await client.moderate({
  content: 'User message here',
  context: {
    userId: 'user_123',
    contentType: 'chat',
    platform: 'mobile',
    language: 'en',
  },
});
```

## Framework Integrations

### Express.js Middleware

```typescript
import express from 'express';
import { createModeryoMiddleware } from '@moderyo/sdk/express';

const app = express();

const moderyo = createModeryoMiddleware({
  apiKey: process.env.MODERYO_API_KEY!,
});

app.post('/api/messages', 
  moderyo.moderate({ field: 'body.content' }),
  (req, res) => {
    if (req.moderation?.action === 'block') {
      return res.status(400).json({ 
        error: 'Content blocked',
        reason: req.moderation.explanation 
      });
    }
    
    // Process the message...
    res.json({ status: 'ok' });
  }
);
```

### Fastify Plugin

```typescript
import Fastify from 'fastify';
import { moderyoPlugin } from '@moderyo/sdk/fastify';

const fastify = Fastify();

fastify.register(moderyoPlugin, {
  apiKey: process.env.MODERYO_API_KEY!,
});

fastify.post('/api/messages', async (request, reply) => {
  const result = await request.moderyo.moderate({
    content: request.body.content,
  });
  
  if (result.action === 'block') {
    return reply.status(400).send({ error: 'Content blocked' });
  }
  
  return { status: 'ok' };
});
```

## TypeScript Types

```typescript
import type {
  ModerationResult,
  ModerationRequest,
  Categories,
  CategoryScores,
  Decision,
  ModeryoConfig,
} from '@moderyo/sdk';

// Full type safety
const request: ModerationRequest = {
  content: 'User message',
  context: {
    userId: 'user_123',
  },
};

const result: ModerationResult = await client.moderate(request);

// Access typed properties
const action: Decision = result.action;  // 'allow' | 'flag' | 'block'
const categories: Categories = result.categories;
const scores: CategoryScores = result.scores;
```

## Development

```bash
# Clone repository
git clone https://github.com/moderyo/moderyo-js.git
cd moderyo-js

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint

# Type check
npm run typecheck
```

## Examples

See the [playground-examples](https://github.com/moderyo/playground-examples/tree/main/nodejs) repository for a complete working Express server example.

## License

MIT License - see [LICENSE](LICENSE) for details.
