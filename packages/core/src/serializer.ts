import { createHash } from 'crypto';
import { AgentState, Checkpoint, CheckpointMetadata } from './types.js';

export class StateSerializer {
  private readonly version = 1;

  serialize(state: AgentState, options: {
    agentId: string;
    sessionId: string;
    tags?: string[];
    description?: string;
  }): Checkpoint {
    const serializedState = JSON.stringify(state, this.replacer);
    const checksum = this.calculateChecksum(serializedState);
    
    const metadata: CheckpointMetadata = {
      id: this.generateId(),
      agentId: options.agentId,
      sessionId: options.sessionId,
      timestamp: Date.now(),
      tags: options.tags || [],
      version: this.version,
      size: serializedState.length,
      checksum,
    };
    
    if (options.description) {
      metadata.description = options.description;
    }

    return {
      metadata,
      state,
    };
  }

  deserialize(checkpoint: Checkpoint): AgentState {
    // Validate version compatibility
    if (checkpoint.metadata.version > this.version) {
      throw new Error(`Unsupported checkpoint version: ${checkpoint.metadata.version}`);
    }

    // Validate integrity
    const serializedState = JSON.stringify(checkpoint.state, this.replacer);
    const calculatedChecksum = this.calculateChecksum(serializedState);
    
    if (calculatedChecksum !== checkpoint.metadata.checksum) {
      throw new Error(`Checkpoint integrity check failed. Expected ${checkpoint.metadata.checksum}, got ${calculatedChecksum}`);
    }

    return checkpoint.state;
  }

  calculateDiff(oldState: AgentState, newState: AgentState): Array<{
    op: 'add' | 'remove' | 'replace';
    path: string;
    value?: any;
    oldValue?: any;
  }> {
    const operations: Array<{
      op: 'add' | 'remove' | 'replace';
      path: string;
      value?: any;
      oldValue?: any;
    }> = [];

    this.diffObjects(oldState, newState, '', operations);
    return operations;
  }

  private replacer(key: string, value: any): any {
    // Handle special types that don't serialize well
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    if (value instanceof Map) {
      return { __type: 'Map', value: Array.from(value.entries()) };
    }
    if (value instanceof Set) {
      return { __type: 'Set', value: Array.from(value) };
    }
    return value;
  }

  private reviver(key: string, value: any): any {
    if (value && typeof value === 'object' && value.__type) {
      switch (value.__type) {
        case 'Date':
          return new Date(value.value);
        case 'Map':
          return new Map(value.value);
        case 'Set':
          return new Set(value.value);
      }
    }
    return value;
  }

  private calculateChecksum(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  private generateId(): string {
    return `ckpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private diffObjects(
    oldObj: any,
    newObj: any,
    path: string,
    operations: Array<{
      op: 'add' | 'remove' | 'replace';
      path: string;
      value?: any;
      oldValue?: any;
    }>
  ): void {
    // Handle primitive values
    if (oldObj !== newObj && (typeof oldObj !== 'object' || typeof newObj !== 'object')) {
      operations.push({
        op: 'replace',
        path: path || '/',
        value: newObj,
        oldValue: oldObj,
      });
      return;
    }

    // Handle null values
    if (oldObj === null && newObj !== null) {
      operations.push({
        op: 'replace',
        path: path || '/',
        value: newObj,
        oldValue: null,
      });
      return;
    }
    if (oldObj !== null && newObj === null) {
      operations.push({
        op: 'replace',
        path: path || '/',
        value: null,
        oldValue: oldObj,
      });
      return;
    }

    // Handle arrays
    if (Array.isArray(oldObj) && Array.isArray(newObj)) {
      const maxLength = Math.max(oldObj.length, newObj.length);
      for (let i = 0; i < maxLength; i++) {
        const currentPath = `${path}/${i}`;
        if (i >= oldObj.length) {
          operations.push({
            op: 'add',
            path: currentPath,
            value: newObj[i],
          });
        } else if (i >= newObj.length) {
          operations.push({
            op: 'remove',
            path: currentPath,
            oldValue: oldObj[i],
          });
        } else {
          this.diffObjects(oldObj[i], newObj[i], currentPath, operations);
        }
      }
      return;
    }

    // Handle objects
    if (oldObj && newObj && typeof oldObj === 'object' && typeof newObj === 'object') {
      const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
      
      for (const key of allKeys) {
        const currentPath = path ? `${path}/${key}` : key;
        
        if (!(key in oldObj)) {
          operations.push({
            op: 'add',
            path: currentPath,
            value: newObj[key],
          });
        } else if (!(key in newObj)) {
          operations.push({
            op: 'remove',
            path: currentPath,
            oldValue: oldObj[key],
          });
        } else {
          this.diffObjects(oldObj[key], newObj[key], currentPath, operations);
        }
      }
    }
  }
}