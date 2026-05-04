export interface AgentState {
  // Task tracking
  taskProgress: Record<string, any>;
  decisions: Array<{
    timestamp: number;
    decision: string;
    reasoning: string;
    context: Record<string, any>;
  }>;
  
  // Context and memory
  context: Record<string, any>;
  memory: Record<string, any>;
  
  // Action tracking
  pendingActions: Array<{
    id: string;
    type: string;
    payload: any;
    scheduledAt: number;
  }>;
  
  // Tool results and history
  toolResults: Array<{
    toolName: string;
    input: any;
    output: any;
    timestamp: number;
    success: boolean;
  }>;
  
  // Agent metadata
  agentId: string;
  sessionId: string;
  timestamp: number;
}

export interface CheckpointMetadata {
  id: string;
  agentId: string;
  sessionId: string;
  timestamp: number;
  parentCheckpointId?: string;
  tags: string[];
  description?: string;
  version: number;
  size: number;
  checksum: string;
}

export interface Checkpoint {
  metadata: CheckpointMetadata;
  state: AgentState;
}

export interface CheckpointDelta {
  checkpointId: string;
  parentCheckpointId: string;
  operations: Array<{
    op: 'add' | 'remove' | 'replace';
    path: string;
    value?: any;
    oldValue?: any;
  }>;
  merkleHash: string;
}

export interface StorageProvider {
  save(checkpoint: Checkpoint): Promise<void>;
  load(checkpointId: string): Promise<Checkpoint>;
  delete(checkpointId: string): Promise<void>;
  list(agentId: string): Promise<CheckpointMetadata[]>;
  exists(checkpointId: string): Promise<boolean>;
}

export interface CheckpointOptions {
  agentId: string;
  sessionId: string;
  tags?: string[];
  description?: string;
  compress?: boolean;
}

export interface RestoreOptions {
  validateIntegrity?: boolean;
  allowPartialRestore?: boolean;
}