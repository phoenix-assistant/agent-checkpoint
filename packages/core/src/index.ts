// Core engine
export { CheckpointEngine } from './engine.js';

// State management
export { StateSerializer } from './serializer.js';
export { MerkleTree } from './merkle.js';

// Storage providers
export { LocalFileStore } from './storage/local.js';

// Types
export type {
  AgentState,
  Checkpoint,
  CheckpointMetadata,
  CheckpointDelta,
  CheckpointOptions,
  RestoreOptions,
  StorageProvider,
} from './types.js';