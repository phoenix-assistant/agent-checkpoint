import { createHash } from 'crypto';

export interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
  data?: any;
  path?: string;
}

export class MerkleTree {
  private root: MerkleNode | null = null;

  constructor(private data: any) {
    this.root = this.buildTree(this.flattenObject(data));
  }

  getHash(): string {
    return this.root?.hash || '';
  }

  findDifferences(otherTree: MerkleTree): string[] {
    const differences: string[] = [];
    this.compareTrees(this.root, otherTree.root, differences);
    return differences;
  }

  private flattenObject(obj: any, prefix = ''): Array<{ path: string; value: any }> {
    const flattened: Array<{ path: string; value: any }> = [];
    
    const flatten = (current: any, currentPath: string): void => {
      if (current === null || typeof current !== 'object') {
        flattened.push({ path: currentPath, value: current });
        return;
      }

      if (Array.isArray(current)) {
        current.forEach((item, index) => {
          flatten(item, `${currentPath}[${index}]`);
        });
        return;
      }

      Object.keys(current).forEach(key => {
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        flatten(current[key], newPath);
      });
    };

    flatten(obj, prefix);
    return flattened.sort((a, b) => a.path.localeCompare(b.path));
  }

  private buildTree(items: Array<{ path: string; value: any }>): MerkleNode | null {
    if (items.length === 0) return null;
    if (items.length === 1) {
      const item = items[0]!;
      return {
        hash: this.hashData(item),
        data: item,
        path: item.path,
      };
    }

    // Create leaf nodes
    let nodes: MerkleNode[] = items.map(item => ({
      hash: this.hashData(item),
      data: item,
      path: item.path,
    }));

    // Build tree bottom-up
    while (nodes.length > 1) {
      const nextLevel: MerkleNode[] = [];
      
      for (let i = 0; i < nodes.length; i += 2) {
        const left = nodes[i]!;
        const right = i + 1 < nodes.length ? nodes[i + 1]! : left;
        
        const parent: MerkleNode = {
          hash: this.hashPair(left.hash, right.hash),
          left,
        };
        
        if (right !== left) {
          parent.right = right;
        }
        
        nextLevel.push(parent);
      }
      
      nodes = nextLevel;
    }

    return nodes[0] || null;
  }

  private hashData(data: { path: string; value: any }): string {
    const serialized = JSON.stringify({ path: data.path, value: data.value });
    return createHash('sha256').update(serialized).digest('hex');
  }

  private hashPair(left: string, right: string): string {
    return createHash('sha256').update(left + right).digest('hex');
  }

  private compareTrees(
    node1: MerkleNode | null | undefined,
    node2: MerkleNode | null | undefined,
    differences: string[]
  ): void {
    // Both null - no difference
    if (!node1 && !node2) return;
    
    // One is null - difference
    if (!node1 || !node2) {
      const existingNode = node1 || node2;
      if (existingNode?.path) {
        differences.push(existingNode.path);
      } else if (existingNode?.data?.path) {
        differences.push(existingNode.data.path);
      }
      return;
    }

    // Same hash - no difference
    if (node1.hash === node2.hash) return;

    // Leaf nodes - add to differences
    if (node1.data && node2.data) {
      differences.push(node1.data.path);
      return;
    }

    // Internal nodes - recurse
    this.compareTrees(node1.left, node2.left, differences);
    this.compareTrees(node1.right, node2.right, differences);
  }

  static diff(oldData: any, newData: any): string[] {
    const oldTree = new MerkleTree(oldData);
    const newTree = new MerkleTree(newData);
    return oldTree.findDifferences(newTree);
  }
}