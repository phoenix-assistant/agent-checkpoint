# Agent Checkpoint

[![CI](https://github.com/phoenix-assistant/agent-checkpoint/workflows/CI/badge.svg)](https://github.com/phoenix-assistant/agent-checkpoint/actions)
[![npm version](https://badge.fury.io/js/%40phoenixaihub%2Fagent-checkpoint-core.svg)](https://badge.fury.io/js/%40phoenixaihub%2Fagent-checkpoint-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Durable checkpoint/restore system for AI agent cognitive state. Resume from any checkpoint after crashes, provider outages, or intelligence brownouts.

## Architecture

```
Agent Runtime
  └─ Checkpoint Middleware (wraps agent loop)
       ├─ State Capture → Serializer → Delta Engine → Storage
       └─ Restore ← Deserializer ← Integrity Check ← Storage
```

## Features

- **🔐 Integrity Guaranteed**: SHA-256 checksums validate every checkpoint
- **⚡ Incremental Diffing**: Merkle tree-based efficient state comparison
- **🗄️ Pluggable Storage**: Local files, S3 (interface provided)
- **🎯 Framework Agnostic**: Works with any agent architecture
- **🛠️ Rich CLI Tools**: Complete checkpoint management from command line
- **📊 Versioned Schema**: Forward-compatible checkpoint format

## Quick Start

### Installation

```bash
# Core engine
npm install @phoenixaihub/agent-checkpoint-core

# CLI tools
npm install -g @phoenixaihub/agent-checkpoint-cli

# Framework integrations
npm install @phoenixaihub/agent-checkpoint-sdk
```

### Basic Usage

```typescript
import { CheckpointEngine, LocalFileStore } from '@phoenixaihub/agent-checkpoint-core';

const engine = new CheckpointEngine(new LocalFileStore('./checkpoints'));

// Create agent state
const state = {
  taskProgress: { task1: 'completed', task2: 'in-progress' },
  decisions: [],
  context: { environment: 'production' },
  memory: { lastAction: 'analyze' },
  pendingActions: [],
  toolResults: [],
  agentId: 'my-agent',
  sessionId: 'session-123',
  timestamp: Date.now()
};

// Create checkpoint
const checkpointId = await engine.createCheckpoint(state, {
  agentId: 'my-agent',
  sessionId: 'session-123',
  tags: ['milestone'],
  description: 'Completed initial analysis'
});

// Restore state
const restoredState = await engine.restore(checkpointId);
```

### Middleware Pattern

```typescript
import { CheckpointMiddleware } from '@phoenixaihub/agent-checkpoint-sdk';

const middleware = new CheckpointMiddleware({
  engine,
  agentId: 'my-agent',
  sessionId: 'session-123',
  autoCheckpointInterval: 30000, // 30 seconds
  onCheckpoint: (id) => console.log(`Checkpoint created: ${id}`),
  onError: (error) => console.error('Checkpoint error:', error)
});

// Wrap your agent function
const checkpointedAgent = middleware.wrap(async (context, task) => {
  // Your agent logic here
  context.state.taskProgress[task.id] = 'started';
  
  // Auto-checkpoint happens every 30s
  // Manual checkpoint
  const checkpointId = await context.checkpoint();
  
  // Continue processing...
  return result;
});

// Run with automatic checkpointing
await checkpointedAgent({ id: 'task-1', type: 'analysis' });
```

## CLI Usage

```bash
# Create checkpoint from JSON state
checkpoint save state.json -a my-agent -S session-123 -t milestone -d "Analysis complete"

# List checkpoints
checkpoint list my-agent

# Restore state
checkpoint restore ckpt_1640000000000_abc123def -o restored-state.json

# Compare checkpoints
checkpoint diff ckpt_1640000000000_abc123def ckpt_1640000060000_xyz789abc

# Inspect checkpoint
checkpoint inspect ckpt_1640000000000_abc123def

# Clean up old checkpoints
checkpoint prune my-agent --keep 10

# Validate integrity
checkpoint validate ckpt_1640000000000_abc123def
```

## API Reference

### Core Classes

#### `CheckpointEngine`

Main checkpoint management class.

```typescript
class CheckpointEngine {
  constructor(storage?: StorageProvider)
  
  // Create checkpoint from agent state
  createCheckpoint(state: AgentState, options: CheckpointOptions): Promise<string>
  
  // Restore state from checkpoint
  restore(checkpointId: string, options?: RestoreOptions): Promise<AgentState>
  
  // List checkpoints for agent
  listCheckpoints(agentId: string): Promise<CheckpointMetadata[]>
  
  // Delete checkpoint
  deleteCheckpoint(checkpointId: string): Promise<void>
  
  // Find differences between checkpoints
  findDifferences(id1: string, id2: string): Promise<string[]>
  
  // Validate checkpoint integrity
  validateCheckpointIntegrity(checkpointId: string): Promise<boolean>
}
```

#### `AgentState`

Core state structure for agent cognitive state.

```typescript
interface AgentState {
  taskProgress: Record<string, any>;        // Current task status
  decisions: Decision[];                    // Decision history with reasoning
  context: Record<string, any>;            // Environment and runtime context
  memory: Record<string, any>;             // Persistent agent memory
  pendingActions: PendingAction[];         // Scheduled future actions
  toolResults: ToolResult[];               // History of tool executions
  agentId: string;                         // Agent identifier
  sessionId: string;                       // Session identifier
  timestamp: number;                       // State timestamp
}
```

### Storage Providers

#### `LocalFileStore`

File system storage implementation.

```typescript
class LocalFileStore implements StorageProvider {
  constructor(basePath: string = './checkpoints')
  
  save(checkpoint: Checkpoint): Promise<void>
  load(checkpointId: string): Promise<Checkpoint>
  delete(checkpointId: string): Promise<void>
  list(agentId: string): Promise<CheckpointMetadata[]>
  exists(checkpointId: string): Promise<boolean>
}
```

### Framework Integration

#### `CheckpointMiddleware`

Wrapper for automatic checkpointing in agent loops.

```typescript
class CheckpointMiddleware {
  constructor(options: MiddlewareOptions)
  
  // Wrap agent function with checkpointing
  wrap<T>(agentFn: (context: AgentContext, ...args: any[]) => Promise<T>): (...args: any[]) => Promise<T>
  
  // Update state methods
  addDecision(decision: string, reasoning: string, context?: Record<string, any>): void
  addToolResult(toolName: string, input: any, output: any, success?: boolean): void
  setTaskProgress(taskId: string, progress: any): void
  setContext(key: string, value: any): void
  setMemory(key: string, value: any): void
}
```

## Comparison

| Feature | Agent Checkpoint | Manual Save/Load | Database Sessions |
|---------|------------------|-------------------|-------------------|
| Integrity Validation | ✅ SHA-256 checksums | ❌ No validation | ⚠️ Depends on DB |
| Incremental Diffing | ✅ Merkle trees | ❌ Full state only | ❌ No diffing |
| Framework Agnostic | ✅ Any architecture | ✅ Manual implementation | ❌ DB-specific |
| Versioned Schema | ✅ Forward compatible | ❌ Breaking changes | ⚠️ Migration required |
| Pluggable Storage | ✅ Local, S3, custom | ❌ Code changes needed | ❌ Single DB |
| CLI Tools | ✅ Full management | ❌ Custom scripts | ⚠️ DB-specific tools |
| Auto-checkpoint | ✅ Middleware pattern | ❌ Manual triggers | ⚠️ Custom implementation |

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run linting
pnpm lint

# Format code
pnpm format
```

### Package Structure

```
packages/
├── core/           # @phoenixaihub/agent-checkpoint-core
│   ├── src/
│   │   ├── engine.ts      # Main checkpoint engine
│   │   ├── serializer.ts  # State serialization
│   │   ├── merkle.ts      # Merkle tree diffing
│   │   ├── storage/       # Storage providers
│   │   └── types.ts       # TypeScript definitions
│   └── tests/
├── cli/            # @phoenixaihub/agent-checkpoint-cli
│   └── src/
│       └── cli.ts         # Command line interface
└── sdk/            # @phoenixaihub/agent-checkpoint-sdk
    └── src/
        ├── middleware.ts  # Middleware wrapper
        └── adapters.ts    # Framework adapters
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Coding Standards

- TypeScript strict mode enabled
- ESLint + Prettier for code style
- 100% test coverage for core functionality
- Comprehensive JSDoc comments

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test --coverage
```

## License

MIT © Phoenix AI

## Links

- [GitHub Repository](https://github.com/phoenix-assistant/agent-checkpoint)
- [npm Package](https://www.npmjs.com/package/@phoenixaihub/agent-checkpoint-core)
- [Issues](https://github.com/phoenix-assistant/agent-checkpoint/issues)
- [Discussions](https://github.com/phoenix-assistant/agent-checkpoint/discussions)