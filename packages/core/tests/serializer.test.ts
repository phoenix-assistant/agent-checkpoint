import { describe, it, expect } from 'vitest';
import { StateSerializer } from '../src/serializer.js';
import type { AgentState } from '../src/types.js';

describe('StateSerializer', () => {
  let serializer: StateSerializer;
  let sampleState: AgentState;

  beforeEach(() => {
    serializer = new StateSerializer();
    sampleState = {
      taskProgress: { task1: 'completed' },
      decisions: [],
      context: { env: 'test' },
      memory: {},
      pendingActions: [],
      toolResults: [],
      agentId: 'test-agent',
      sessionId: 'session-123',
      timestamp: 1640000000000
    };
  });

  it('should serialize state to checkpoint', () => {
    const checkpoint = serializer.serialize(sampleState, {
      agentId: 'test-agent',
      sessionId: 'session-123',
      tags: ['test']
    });

    expect(checkpoint.metadata.agentId).toBe('test-agent');
    expect(checkpoint.metadata.sessionId).toBe('session-123');
    expect(checkpoint.metadata.tags).toEqual(['test']);
    expect(checkpoint.metadata.checksum).toBeDefined();
    expect(checkpoint.state).toEqual(sampleState);
  });

  it('should deserialize checkpoint to state', () => {
    const checkpoint = serializer.serialize(sampleState, {
      agentId: 'test-agent',
      sessionId: 'session-123'
    });

    const deserializedState = serializer.deserialize(checkpoint);
    expect(deserializedState).toEqual(sampleState);
  });

  it('should detect integrity violations', () => {
    const checkpoint = serializer.serialize(sampleState, {
      agentId: 'test-agent',
      sessionId: 'session-123'
    });

    // Corrupt the checksum
    checkpoint.metadata.checksum = 'invalid-checksum';

    expect(() => serializer.deserialize(checkpoint))
      .toThrow('Checkpoint integrity check failed');
  });

  it('should calculate diffs between states', () => {
    const oldState = sampleState;
    const newState = {
      ...sampleState,
      taskProgress: { task1: 'completed', task2: 'new' },
      context: { env: 'production' }
    };

    const diff = serializer.calculateDiff(oldState, newState);
    
    expect(diff).toContainEqual({
      op: 'add',
      path: 'taskProgress/task2',
      value: 'new'
    });
    
    expect(diff).toContainEqual({
      op: 'replace',
      path: 'context/env',
      value: 'production',
      oldValue: 'test'
    });
  });

  it('should handle special types in serialization', () => {
    const specialState = {
      ...sampleState,
      context: {
        date: new Date('2024-01-01'),
        map: new Map([['key', 'value']]),
        set: new Set(['a', 'b'])
      }
    };

    const checkpoint = serializer.serialize(specialState, {
      agentId: 'test-agent',
      sessionId: 'session-123'
    });

    const deserialized = serializer.deserialize(checkpoint);
    expect(deserialized.context.date).toBeInstanceOf(Date);
    expect(deserialized.context.map).toBeInstanceOf(Map);
    expect(deserialized.context.set).toBeInstanceOf(Set);
  });
});