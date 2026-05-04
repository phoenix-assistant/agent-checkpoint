#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { CheckpointEngine, LocalFileStore } from '@phoenixaihub/agent-checkpoint-core';
import { promises as fs } from 'fs';
import { join } from 'path';

const program = new Command();

// Global configuration
const DEFAULT_STORAGE_PATH = join(process.cwd(), 'checkpoints');
let engine: CheckpointEngine;

async function initEngine(storagePath: string = DEFAULT_STORAGE_PATH): Promise<void> {
  if (!engine) {
    engine = new CheckpointEngine(new LocalFileStore(storagePath));
  }
}

// Helper functions
function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

// Commands
program
  .name('checkpoint')
  .description('AI Agent Checkpoint CLI')
  .version('1.0.0')
  .option('-s, --storage <path>', 'Storage path for checkpoints', DEFAULT_STORAGE_PATH);

program
  .command('save')
  .description('Create a checkpoint from JSON state file')
  .argument('<state-file>', 'Path to JSON state file')
  .requiredOption('-a, --agent-id <id>', 'Agent ID')
  .requiredOption('-S, --session-id <id>', 'Session ID')
  .option('-t, --tags <tags>', 'Comma-separated tags')
  .option('-d, --description <desc>', 'Checkpoint description')
  .action(async (stateFile, options) => {
    const spinner = ora('Creating checkpoint...').start();
    
    try {
      await initEngine(program.opts().storage);
      
      // Load state from file
      const stateData = await fs.readFile(stateFile, 'utf-8');
      const state = JSON.parse(stateData);
      
      // Ensure required fields
      state.agentId = options.agentId;
      state.sessionId = options.sessionId;
      state.timestamp = state.timestamp || Date.now();
      
      const checkpointId = await engine.createCheckpoint(state, {
        agentId: options.agentId,
        sessionId: options.sessionId,
        tags: options.tags ? options.tags.split(',') : [],
        description: options.description,
      });
      
      spinner.succeed(`Checkpoint created: ${chalk.green(checkpointId)}`);
    } catch (error) {
      spinner.fail(`Failed to create checkpoint: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('restore')
  .description('Restore agent state from checkpoint')
  .argument('<checkpoint-id>', 'Checkpoint ID to restore')
  .option('-o, --output <file>', 'Output file for restored state (default: stdout)')
  .option('--no-validate', 'Skip integrity validation')
  .action(async (checkpointId, options) => {
    const spinner = ora('Restoring checkpoint...').start();
    
    try {
      await initEngine(program.opts().storage);
      
      const state = await engine.restore(checkpointId, {
        validateIntegrity: options.validate,
      });
      
      const stateJson = JSON.stringify(state, null, 2);
      
      if (options.output) {
        await fs.writeFile(options.output, stateJson);
        spinner.succeed(`State restored to ${chalk.green(options.output)}`);
      } else {
        spinner.stop();
        console.log(stateJson);
      }
    } catch (error) {
      spinner.fail(`Failed to restore checkpoint: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List checkpoints for an agent')
  .argument('<agent-id>', 'Agent ID')
  .option('-l, --limit <number>', 'Limit number of results', '20')
  .action(async (agentId, options) => {
    const spinner = ora('Loading checkpoints...').start();
    
    try {
      await initEngine(program.opts().storage);
      
      const checkpoints = await engine.listCheckpoints(agentId);
      const limited = checkpoints.slice(0, parseInt(options.limit));
      
      spinner.stop();
      
      if (limited.length === 0) {
        console.log(chalk.yellow(`No checkpoints found for agent: ${agentId}`));
        return;
      }
      
      const tableData = [
        ['ID', 'Session', 'Date', 'Size', 'Tags', 'Description'],
        ...limited.map(cp => [
          cp.id.substring(0, 20) + '...',
          cp.sessionId,
          formatDate(cp.timestamp),
          formatBytes(cp.size),
          cp.tags.join(', '),
          cp.description || ''
        ])
      ];
      
      console.log(table(tableData));
    } catch (error) {
      spinner.fail(`Failed to list checkpoints: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('diff')
  .description('Show differences between two checkpoints')
  .argument('<checkpoint-id-1>', 'First checkpoint ID')
  .argument('<checkpoint-id-2>', 'Second checkpoint ID')
  .action(async (id1, id2) => {
    const spinner = ora('Calculating differences...').start();
    
    try {
      await initEngine(program.opts().storage);
      
      const differences = await engine.findDifferences(id1, id2);
      
      spinner.stop();
      
      if (differences.length === 0) {
        console.log(chalk.green('No differences found.'));
        return;
      }
      
      console.log(chalk.cyan(`Found ${differences.length} differences:`));
      differences.forEach(path => {
        console.log(`  ${chalk.yellow('~')} ${path}`);
      });
    } catch (error) {
      spinner.fail(`Failed to calculate differences: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('inspect')
  .description('Show checkpoint metadata and contents')
  .argument('<checkpoint-id>', 'Checkpoint ID')
  .option('--metadata-only', 'Show only metadata')
  .action(async (checkpointId, options) => {
    const spinner = ora('Loading checkpoint...').start();
    
    try {
      await initEngine(program.opts().storage);
      
      const metadata = await engine.getCheckpointInfo(checkpointId);
      
      spinner.stop();
      
      // Display metadata
      console.log(chalk.cyan('Checkpoint Metadata:'));
      console.log(`  ID: ${metadata.id}`);
      console.log(`  Agent ID: ${metadata.agentId}`);
      console.log(`  Session ID: ${metadata.sessionId}`);
      console.log(`  Timestamp: ${formatDate(metadata.timestamp)}`);
      console.log(`  Size: ${formatBytes(metadata.size)}`);
      console.log(`  Tags: ${metadata.tags.join(', ')}`);
      console.log(`  Description: ${metadata.description || 'None'}`);
      console.log(`  Version: ${metadata.version}`);
      console.log(`  Checksum: ${metadata.checksum}`);
      
      if (metadata.parentCheckpointId) {
        console.log(`  Parent: ${metadata.parentCheckpointId}`);
      }
      
      if (!options.metadataOnly) {
        console.log('\n' + chalk.cyan('State Contents:'));
        const state = await engine.restore(checkpointId);
        console.log(JSON.stringify(state, null, 2));
      }
    } catch (error) {
      spinner.fail(`Failed to inspect checkpoint: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('prune')
  .description('Remove old checkpoints for an agent')
  .argument('<agent-id>', 'Agent ID')
  .option('--keep <number>', 'Number of recent checkpoints to keep', '10')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .action(async (agentId, options) => {
    const keepCount = parseInt(options.keep);
    const spinner = ora(`${options.dryRun ? 'Analyzing' : 'Pruning'} checkpoints...`).start();
    
    try {
      await initEngine(program.opts().storage);
      
      if (options.dryRun) {
        const checkpoints = await engine.listCheckpoints(agentId);
        const toDelete = checkpoints.slice(keepCount);
        
        spinner.stop();
        
        if (toDelete.length === 0) {
          console.log(chalk.green('No checkpoints to prune.'));
          return;
        }
        
        console.log(chalk.yellow(`Would delete ${toDelete.length} checkpoints:`));
        toDelete.forEach(cp => {
          console.log(`  ${cp.id} (${formatDate(cp.timestamp)})`);
        });
      } else {
        const deletedIds = await engine.pruneCheckpoints(agentId, keepCount);
        
        spinner.succeed(`Pruned ${deletedIds.length} checkpoints`);
        
        if (deletedIds.length > 0) {
          console.log('Deleted checkpoints:');
          deletedIds.forEach(id => {
            console.log(`  ${chalk.red('-')} ${id}`);
          });
        }
      }
    } catch (error) {
      spinner.fail(`Failed to prune checkpoints: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate checkpoint integrity')
  .argument('<checkpoint-id>', 'Checkpoint ID')
  .action(async (checkpointId) => {
    const spinner = ora('Validating checkpoint...').start();
    
    try {
      await initEngine(program.opts().storage);
      
      const isValid = await engine.validateCheckpointIntegrity(checkpointId);
      
      if (isValid) {
        spinner.succeed(chalk.green('Checkpoint is valid'));
      } else {
        spinner.fail(chalk.red('Checkpoint is corrupted or invalid'));
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(`Validation failed: ${error.message}`);
      process.exit(1);
    }
  });

// Global error handler
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('Unhandled error:'), error);
  process.exit(1);
});

program.parse();