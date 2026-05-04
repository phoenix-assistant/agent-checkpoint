import {
  CheckpointEngine,
  AgentState,
  CheckpointOptions,
  StorageProvider,
} from '@phoenixaihub/agent-checkpoint-core';

export interface MiddlewareOptions {
  engine: CheckpointEngine;
  agentId: string;
  sessionId: string;
  autoCheckpointInterval?: number; // milliseconds
  onCheckpoint?: (checkpointId: string) => void;
  onRestore?: (state: AgentState) => void;
  onError?: (error: Error) => void;
}

export interface AgentContext {
  state: AgentState;
  checkpoint: () => Promise<string>;
  restore: (checkpointId: string) => Promise<void>;
}

export class CheckpointMiddleware {
  private engine: CheckpointEngine;
  private options: MiddlewareOptions;
  private intervalId: NodeJS.Timeout | undefined;
  private currentState?: AgentState;

  constructor(options: MiddlewareOptions) {
    this.engine = options.engine;
    this.options = options;
  }

  // Wrap an agent function with checkpointing
  wrap<TArgs extends any[], TReturn>(
    agentFn: (context: AgentContext, ...args: TArgs) => Promise<TReturn>
  ): (...args: TArgs) => Promise<TReturn> {
    return async (...args: TArgs): Promise<TReturn> => {
      const context = this.createContext();
      
      try {
        // Setup auto-checkpointing if configured
        this.startAutoCheckpointing();
        
        // Execute the agent function
        const result = await agentFn(context, ...args);
        
        // Final checkpoint
        await this.checkpoint();
        
        return result;
      } catch (error) {
        this.options.onError?.(error as Error);
        throw error;
      } finally {
        this.stopAutoCheckpointing();
      }
    };
  }

  // Create agent context
  private createContext(): AgentContext {
    return {
      state: this.getCurrentState(),
      checkpoint: () => this.checkpoint(),
      restore: (checkpointId: string) => this.restore(checkpointId),
    };
  }

  // Initialize or get current state
  private getCurrentState(): AgentState {
    if (!this.currentState) {
      this.currentState = {
        taskProgress: {},
        decisions: [],
        context: {},
        memory: {},
        pendingActions: [],
        toolResults: [],
        agentId: this.options.agentId,
        sessionId: this.options.sessionId,
        timestamp: Date.now(),
      };
    }
    return this.currentState;
  }

  // Create checkpoint
  private async checkpoint(): Promise<string> {
    if (!this.currentState) {
      throw new Error('No state to checkpoint');
    }

    try {
      const checkpointId = await this.engine.createCheckpoint(
        this.currentState,
        {
          agentId: this.options.agentId,
          sessionId: this.options.sessionId,
          tags: ['auto'],
          description: 'Auto-generated checkpoint',
        }
      );

      this.options.onCheckpoint?.(checkpointId);
      return checkpointId;
    } catch (error) {
      this.options.onError?.(error as Error);
      throw error;
    }
  }

  // Restore from checkpoint
  private async restore(checkpointId: string): Promise<void> {
    try {
      const restoredState = await this.engine.restore(checkpointId);
      this.currentState = restoredState;
      this.options.onRestore?.(restoredState);
    } catch (error) {
      this.options.onError?.(error as Error);
      throw error;
    }
  }

  // Start auto-checkpointing
  private startAutoCheckpointing(): void {
    if (this.options.autoCheckpointInterval && this.options.autoCheckpointInterval > 0) {
      this.intervalId = setInterval(async () => {
        try {
          await this.checkpoint();
        } catch (error) {
          this.options.onError?.(error as Error);
        }
      }, this.options.autoCheckpointInterval);
    }
  }

  // Stop auto-checkpointing
  private stopAutoCheckpointing(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  // Update state
  updateState(updater: (state: AgentState) => AgentState): void {
    this.currentState = updater(this.getCurrentState());
    this.currentState.timestamp = Date.now();
  }

  // Add decision to state
  addDecision(decision: string, reasoning: string, context: Record<string, any> = {}): void {
    this.updateState(state => ({
      ...state,
      decisions: [
        ...state.decisions,
        {
          timestamp: Date.now(),
          decision,
          reasoning,
          context,
        },
      ],
    }));
  }

  // Add tool result to state
  addToolResult(
    toolName: string,
    input: any,
    output: any,
    success: boolean = true
  ): void {
    this.updateState(state => ({
      ...state,
      toolResults: [
        ...state.toolResults,
        {
          toolName,
          input,
          output,
          timestamp: Date.now(),
          success,
        },
      ],
    }));
  }

  // Update task progress
  setTaskProgress(taskId: string, progress: any): void {
    this.updateState(state => ({
      ...state,
      taskProgress: {
        ...state.taskProgress,
        [taskId]: progress,
      },
    }));
  }

  // Update context
  setContext(key: string, value: any): void {
    this.updateState(state => ({
      ...state,
      context: {
        ...state.context,
        [key]: value,
      },
    }));
  }

  // Update memory
  setMemory(key: string, value: any): void {
    this.updateState(state => ({
      ...state,
      memory: {
        ...state.memory,
        [key]: value,
      },
    }));
  }

  // Add pending action
  addPendingAction(
    id: string,
    type: string,
    payload: any,
    scheduledAt: number = Date.now()
  ): void {
    this.updateState(state => ({
      ...state,
      pendingActions: [
        ...state.pendingActions,
        { id, type, payload, scheduledAt },
      ],
    }));
  }

  // Remove pending action
  removePendingAction(id: string): void {
    this.updateState(state => ({
      ...state,
      pendingActions: state.pendingActions.filter(action => action.id !== id),
    }));
  }
}