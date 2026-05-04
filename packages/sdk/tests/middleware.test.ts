import { describe, it, expect } from 'vitest';
import { CheckpointMiddleware } from '../src/middleware.js';
import { CheckpointEngine, LocalFileStore } from '@phoenixaihub/agent-checkpoint-core';

describe('CheckpointMiddleware', () => {
  it('should create middleware instance', () => {
    const engine = new CheckpointEngine(new LocalFileStore('./test-checkpoints'));
    const middleware = new CheckpointMiddleware({
      engine,
      agentId: 'test-agent',
      sessionId: 'test-session'
    });
    
    expect(middleware).toBeDefined();
  });
});