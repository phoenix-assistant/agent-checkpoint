import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { StorageProvider, Checkpoint, CheckpointMetadata } from '../types.js';

export class LocalFileStore implements StorageProvider {
  constructor(private basePath: string = './checkpoints') {}

  async save(checkpoint: Checkpoint): Promise<void> {
    const checkpointPath = this.getCheckpointPath(checkpoint.metadata.id);
    const metadataPath = this.getMetadataPath(checkpoint.metadata.id);
    
    // Ensure directory exists
    await fs.mkdir(dirname(checkpointPath), { recursive: true });
    
    // Save checkpoint data and metadata separately for efficiency
    await Promise.all([
      fs.writeFile(checkpointPath, JSON.stringify(checkpoint.state, null, 2)),
      fs.writeFile(metadataPath, JSON.stringify(checkpoint.metadata, null, 2)),
    ]);
  }

  async load(checkpointId: string): Promise<Checkpoint> {
    const checkpointPath = this.getCheckpointPath(checkpointId);
    const metadataPath = this.getMetadataPath(checkpointId);
    
    try {
      const [stateData, metadataData] = await Promise.all([
        fs.readFile(checkpointPath, 'utf-8'),
        fs.readFile(metadataPath, 'utf-8'),
      ]);
      
      const state = JSON.parse(stateData);
      const metadata = JSON.parse(metadataData);
      
      return { metadata, state };
    } catch (error) {
      throw new Error(`Failed to load checkpoint ${checkpointId}: ${error}`);
    }
  }

  async delete(checkpointId: string): Promise<void> {
    const checkpointPath = this.getCheckpointPath(checkpointId);
    const metadataPath = this.getMetadataPath(checkpointId);
    
    try {
      await Promise.all([
        fs.unlink(checkpointPath).catch(() => {}), // Ignore if file doesn't exist
        fs.unlink(metadataPath).catch(() => {}),
      ]);
    } catch (error) {
      throw new Error(`Failed to delete checkpoint ${checkpointId}: ${error}`);
    }
  }

  async list(agentId: string): Promise<CheckpointMetadata[]> {
    try {
      await fs.access(this.basePath);
    } catch {
      return []; // Directory doesn't exist
    }
    
    const entries = await fs.readdir(this.basePath);
    const metadataFiles = entries.filter(file => file.endsWith('.meta.json'));
    
    const metadataPromises = metadataFiles.map(async (file) => {
      try {
        const metadataPath = join(this.basePath, file);
        const data = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(data) as CheckpointMetadata;
        return metadata.agentId === agentId ? metadata : null;
      } catch {
        return null; // Skip corrupted metadata files
      }
    });
    
    const metadataList = await Promise.all(metadataPromises);
    return metadataList
      .filter((metadata): metadata is CheckpointMetadata => metadata !== null)
      .sort((a: CheckpointMetadata, b: CheckpointMetadata) => b.timestamp - a.timestamp); // Most recent first
  }

  async exists(checkpointId: string): Promise<boolean> {
    const checkpointPath = this.getCheckpointPath(checkpointId);
    const metadataPath = this.getMetadataPath(checkpointId);
    
    try {
      await Promise.all([
        fs.access(checkpointPath),
        fs.access(metadataPath),
      ]);
      return true;
    } catch {
      return false;
    }
  }

  async prune(agentId: string, keepCount: number): Promise<string[]> {
    const checkpoints = await this.list(agentId);
    
    if (checkpoints.length <= keepCount) {
      return []; // Nothing to prune
    }
    
    const toDelete = checkpoints.slice(keepCount);
    const deletedIds: string[] = [];
    
    for (const checkpoint of toDelete) {
      try {
        await this.delete(checkpoint.id);
        deletedIds.push(checkpoint.id);
      } catch (error) {
        console.warn(`Failed to delete checkpoint ${checkpoint.id}:`, error);
      }
    }
    
    return deletedIds;
  }

  private getCheckpointPath(checkpointId: string): string {
    // Extract metadata from checkpoint - we'll need agent ID for proper organization
    // For now, let's use a simpler flat structure
    return join(this.basePath, `${checkpointId}.json`);
  }

  private getMetadataPath(checkpointId: string): string {
    return join(this.basePath, `${checkpointId}.meta.json`);
  }
}