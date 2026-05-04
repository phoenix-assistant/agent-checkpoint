import { StateSerializer } from './serializer.js';
import { MerkleTree } from './merkle.js';
import { LocalFileStore } from './storage/local.js';
import {
  AgentState,
  Checkpoint,
  CheckpointOptions,
  RestoreOptions,
  StorageProvider,
  CheckpointMetadata,
} from './types.js';

export class CheckpointEngine {
  private serializer = new StateSerializer();
  private storage: StorageProvider;

  constructor(storage?: StorageProvider) {
    this.storage = storage || new LocalFileStore();
  }

  async createCheckpoint(
    state: AgentState,
    options: CheckpointOptions
  ): Promise<string> {
    const serializeOptions: {
      agentId: string;
      sessionId: string;
      tags?: string[];
      description?: string;
    } = {
      agentId: options.agentId,
      sessionId: options.sessionId,
    };
    
    if (options.tags) {
      serializeOptions.tags = options.tags;
    }
    
    if (options.description) {
      serializeOptions.description = options.description;
    }
    
    const checkpoint = this.serializer.serialize(state, serializeOptions);

    await this.storage.save(checkpoint);
    return checkpoint.metadata.id;
  }

  async restore(
    checkpointId: string,
    options: RestoreOptions = {}
  ): Promise<AgentState> {
    const checkpoint = await this.storage.load(checkpointId);
    
    if (options.validateIntegrity !== false) {
      // Integrity validation is performed in the serializer
      return this.serializer.deserialize(checkpoint);
    }
    
    return checkpoint.state;
  }

  async listCheckpoints(agentId: string): Promise<CheckpointMetadata[]> {
    return this.storage.list(agentId);
  }

  async deleteCheckpoint(checkpointId: string): Promise<void> {
    await this.storage.delete(checkpointId);
  }

  async checkpointExists(checkpointId: string): Promise<boolean> {
    return this.storage.exists(checkpointId);
  }

  async findDifferences(
    checkpointId1: string,
    checkpointId2: string
  ): Promise<string[]> {
    const [checkpoint1, checkpoint2] = await Promise.all([
      this.storage.load(checkpointId1),
      this.storage.load(checkpointId2),
    ]);

    return MerkleTree.diff(checkpoint1.state, checkpoint2.state);
  }

  async calculateStateDiff(oldState: AgentState, newState: AgentState): Promise<Array<{
    op: 'add' | 'remove' | 'replace';
    path: string;
    value?: any;
    oldValue?: any;
  }>> {
    return this.serializer.calculateDiff(oldState, newState);
  }

  async createIncrementalCheckpoint(
    state: AgentState,
    parentCheckpointId: string,
    options: CheckpointOptions
  ): Promise<string> {
    const parentCheckpoint = await this.storage.load(parentCheckpointId);
    const diff = this.serializer.calculateDiff(parentCheckpoint.state, state);
    
    // For now, we still create full checkpoints but store the parent reference
    const serializeOptions: {
      agentId: string;
      sessionId: string;
      tags?: string[];
      description?: string;
    } = {
      agentId: options.agentId,
      sessionId: options.sessionId,
    };
    
    if (options.tags) {
      serializeOptions.tags = options.tags;
    }
    
    if (options.description) {
      serializeOptions.description = options.description;
    }
    
    const checkpoint = this.serializer.serialize(state, serializeOptions);
    
    // Add parent reference
    checkpoint.metadata.parentCheckpointId = parentCheckpointId;
    
    await this.storage.save(checkpoint);
    return checkpoint.metadata.id;
  }

  async pruneCheckpoints(agentId: string, keepCount: number = 10): Promise<string[]> {
    if ('prune' in this.storage && typeof this.storage.prune === 'function') {
      return (this.storage as any).prune(agentId, keepCount);
    }
    
    // Fallback implementation
    const checkpoints = await this.listCheckpoints(agentId);
    if (checkpoints.length <= keepCount) {
      return [];
    }
    
    const toDelete = checkpoints.slice(keepCount);
    const deletedIds: string[] = [];
    
    for (const checkpoint of toDelete) {
      try {
        await this.deleteCheckpoint(checkpoint.id);
        deletedIds.push(checkpoint.id);
      } catch (error) {
        console.warn(`Failed to delete checkpoint ${checkpoint.id}:`, error);
      }
    }
    
    return deletedIds;
  }

  async getCheckpointInfo(checkpointId: string): Promise<CheckpointMetadata> {
    const checkpoint = await this.storage.load(checkpointId);
    return checkpoint.metadata;
  }

  async validateCheckpointIntegrity(checkpointId: string): Promise<boolean> {
    try {
      const checkpoint = await this.storage.load(checkpointId);
      this.serializer.deserialize(checkpoint);
      return true;
    } catch {
      return false;
    }
  }

  // Utility method for creating agent state
  static createAgentState(options: {
    agentId: string;
    sessionId: string;
    taskProgress?: Record<string, any>;
    context?: Record<string, any>;
    memory?: Record<string, any>;
  }): AgentState {
    return {
      taskProgress: options.taskProgress || {},
      decisions: [],
      context: options.context || {},
      memory: options.memory || {},
      pendingActions: [],
      toolResults: [],
      agentId: options.agentId,
      sessionId: options.sessionId,
      timestamp: Date.now(),
    };
  }
}