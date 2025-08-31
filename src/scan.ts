import fs from 'node:fs/promises';
import path from 'node:path';

const IGNORE_DIRS = new Set(['.git', 'node_modules']);

export async function scanDir(root: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (IGNORE_DIRS.has(ent.name)) continue;
        await walk(p);
      } else if (ent.isFile()) {
        if (ent.name.endsWith('.jsonl')) {
          results.push(p);
        }
      }
    }
  }

  await walk(root);
  return results;
}

export async function getMtime(file: string): Promise<number> {
  try {
    const st = await fs.stat(file);
    return st.mtimeMs;
  } catch {
    return 0;
  }
}

