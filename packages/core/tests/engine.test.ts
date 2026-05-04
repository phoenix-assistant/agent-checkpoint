import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { CheckpointEngine, LocalFileStore } from '../src/index.js';
import type { AgentState } from '../src/types.js';

describe('CheckpointEngine', () => {
  let engine: CheckpointEngine;
  let testDir: string;
  let sampleState: AgentState;

  beforeEach(async () => {
    testDir = join(process.cwd(), 'test-checkpoints');
    await fs.mkdir(testDir, { recursive: true });
    
    engine = new CheckpointEngine(new LocalFileStore(testDir));
    
    sampleState = {
      taskProgress: { task1: 'completed', task2: 'in-progress' },
      decisions: [
        {
          timestamp: 1640000000000,
          decision: 'use-strategy-a',
          reasoning: 'Better performance',
          context: { performance: 0.95 }
        }
      ],
      context: { environment: 'production', mode: 'autonomous' },
      memory: { lastAction: 'analyze', findings: ['issue-1', 'issue-2'] },
      pendingActions: [
        {
          id: 'action-1',
          type: 'execute-plan',
          payload: { plan: 'plan-a' },
          scheduledAt: 1640000060000
        }
      ],
      toolResults: [
        {
          toolName: 'analyzer',
          input: { data: 'sample' },
          output: { result: 'analyzed' },
          timestamp: 1640000000000,
          success: true
        }
      ],
      agentId: 'test-agent',
      sessionId: 'session-123',
      timestamp: 1640000000000
    };
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should create a checkpoint successfully', async () => {
    const checkpointId = await engine.createCheckpoint(sampleState, {
      agentId: 'test-agent',
      sessionId: 'session-123',
      tags: ['test', 'milestone'],
      description: 'Test checkpoint'
    });

    expect(checkpointId).toMatch(/^ckpt_\d+_[a-z0-9]+$/);
    expect(await engine.checkpointExists(checkpointId)).toBe(true);
  });

  it('should restore state correctly', async () => {
    const checkpointId = await engine.createCheckpoint(sampleState, {
      agentId: 'test-agent',
      sessionId: 'session-123'
    });

    const restoredState = await engine.restore(checkpointId);
    expect(restoredState).toEqual(sampleState);
  });

  it('should list checkpoints for an agent', async () => {
    const id1 = await engine.createCheckpoint(sampleState, {
      agentId: 'test-agent',
      sessionId: 'session-123',
      tags: ['first']
    });

    const modifiedState = { ...sampleState, timestamp: Date.now() };
    const id2 = await engine.createCheckpoint(modifiedState, {
      agentId: 'test-agent',
      sessionId: 'session-124',
      tags: ['second']
    });

    const checkpoints = await engine.listCheckpoints('test-agent');
    expect(checkpoints).toHaveLength(2);
    expect(checkpoints.map(c => c.id)).toContain(id1);
    expect(checkpoints.map(c => c.id)).toContain(id2);
  });

  it('should delete checkpoint', async () => {
    const checkpointId = await engine.createCheckpoint(sampleState, {
      agentId: 'test-agent',
      sessionId: 'session-123'
    });

    expect(await engine.checkpointExists(checkpointId)).toBe(true);
    await engine.deleteCheckpoint(checkpointId);
    expect(await engine.checkpointExists(checkpointId)).toBe(false);
  });

  it('should detect differences between states', async () => {
    const id1 = await engine.createCheckpoint(sampleState, {
      agentId: 'test-agent',
      sessionId: 'session-123'
    });

    const modifiedState = {
      ...sampleState,
      context: { ...sampleState.context, newField: 'new-value' }
    };

    const id2 = await engine.createCheckpoint(modifiedState, {
      agentId: 'test-agent',
      sessionId: 'session-123'
    });

    const differences = await engine.findDifferences(id1, id2);
    expect(differences.length).toBeGreaterThan(0);
  });

  it('should calculate state diffs', async () => {
    const oldState = sampleState;
    const newState = {
      ...sampleState,
      taskProgress: { ...sampleState.taskProgress, task3: 'new-task' }
    };

    const diff = await engine.calculateStateDiff(oldState, newState);
    expect(diff).toEqual([
      {
        op: 'add',
        path: 'taskProgress/task3',
        value: 'new-task'
      }
    ]);
  });

  it('should prune old checkpoints', async () => {
    // Create multiple checkpoints
    const ids = [];
    for (let i = 0; i < 5; i++) {
      const id = await engine.createCheckpoint({
        ...sampleState,
        timestamp: Date.now() + i
      }, {
        agentId: 'test-agent',
        sessionId: `session-${i}`
      });
      ids.push(id);
    }

    const deleted = await engine.pruneCheckpoints('test-agent', 3);
    expect(deleted).toHaveLength(2);

    const remaining = await engine.listCheckpoints('test-agent');
    expect(remaining).toHaveLength(3);
  });

  it('should validate checkpoint integrity', async () => {
    const checkpointId = await engine.createCheckpoint(sampleState, {
      agentId: 'test-agent',
      sessionId: 'session-123'
    });

    const isValid = await engine.validateCheckpointIntegrity(checkpointId);
    expect(isValid).toBe(true);
  });

  it('should create agent state utility', () => {
    const state = CheckpointEngine.createAgentState({
      agentId: 'test-agent',
      sessionId: 'session-123',
      taskProgress: { task1: 'completed' },
      context: { env: 'test' }
    });

    expect(state.agentId).toBe('test-agent');
    expect(state.sessionId).toBe('session-123');
    expect(state.taskProgress).toEqual({ task1: 'completed' });
    expect(state.context).toEqual({ env: 'test' });
    expect(state.decisions).toEqual([]);
    expect(typeof state.timestamp).toBe('number');
  });
});