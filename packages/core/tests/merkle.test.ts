import { describe, it, expect } from 'vitest';
import { MerkleTree } from '../src/merkle.js';

describe('MerkleTree', () => {
  it('should create tree and generate hash', () => {
    const data = { a: 1, b: { c: 2, d: 3 } };
    const tree = new MerkleTree(data);
    
    expect(tree.getHash()).toBeTruthy();
    expect(tree.getHash()).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
  });

  it('should find no differences for identical data', () => {
    const data1 = { a: 1, b: { c: 2 } };
    const data2 = { a: 1, b: { c: 2 } };
    
    const tree1 = new MerkleTree(data1);
    const tree2 = new MerkleTree(data2);
    
    const differences = tree1.findDifferences(tree2);
    expect(differences).toHaveLength(0);
  });

  it('should detect differences between data', () => {
    const data1 = { a: 1, b: { c: 2 } };
    const data2 = { a: 1, b: { c: 3, d: 4 } };
    
    const differences = MerkleTree.diff(data1, data2);
    expect(differences.length).toBeGreaterThan(0);
    expect(differences).toContain('b.c');
  });

  it('should handle arrays correctly', () => {
    const data1 = { items: [1, 2, 3] };
    const data2 = { items: [1, 2, 4] };
    
    const differences = MerkleTree.diff(data1, data2);
    expect(differences).toContain('items[2]');
  });

  it('should handle nested objects', () => {
    const data1 = {
      user: { id: 1, profile: { name: 'John', age: 30 } },
      settings: { theme: 'dark' }
    };
    const data2 = {
      user: { id: 1, profile: { name: 'Jane', age: 30 } },
      settings: { theme: 'light', notifications: true }
    };
    
    const differences = MerkleTree.diff(data1, data2);
    expect(differences).toContain('user.profile.name');
    expect(differences).toContain('settings.theme');
    expect(differences).toContain('settings.notifications');
  });

  it('should generate different hashes for different data', () => {
    const tree1 = new MerkleTree({ a: 1 });
    const tree2 = new MerkleTree({ a: 2 });
    
    expect(tree1.getHash()).not.toBe(tree2.getHash());
  });
});