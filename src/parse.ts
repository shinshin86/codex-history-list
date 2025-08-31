import fs from 'node:fs';
import readline from 'node:readline';
import { type SessionSummary, type ParseOptions } from './types.js';

type AnyJson = any;

const textsFromContent = (content: any): string[] => {
  if (content == null) return [];
  if (typeof content === 'string') return [content];
  if (Array.isArray(content)) {
    const out: string[] = [];
    for (const c of content) {
      if (c && typeof c === 'object') {
        if (typeof c.text === 'string') out.push(c.text);
        else if (typeof c.content === 'string') out.push(c.content);
      }
    }
    return out;
  }
  if (typeof content === 'object') {
    if (typeof content.text === 'string') return [content.text];
  }
  return [];
};

const isEnvironmentContext = (text: string): boolean => {
  const t = text.trimStart();
  return t.startsWith('<environment_context>');
};

const extractCwd = (text: string): string | undefined => {
  // Try tag pattern first
  const tag = /<cwd>([^<]+)<\/cwd>/m.exec(text);
  if (tag && tag[1]) return tag[1].trim();
  // Fallback: find a line starting with <cwd>
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const m = /<cwd>\s*([^<]+)\s*/.exec(line);
    if (m && m[1]) return m[1].trim();
  }
  return undefined;
};

export const parseFile = async (file: string, opts: ParseOptions = {}): Promise<SessionSummary> => {
  const stream = fs.createReadStream(file, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let cwd: string | undefined;
  let ask: string | undefined;
  let timestamp: string | undefined;

  try {
    for await (const line of rl) {
      if (!line || !line.trim()) continue;
      let obj: AnyJson;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }

      if (!timestamp && typeof obj?.timestamp === 'string') {
        timestamp = obj.timestamp;
      }

      if (obj?.record_type === 'state') {
        continue;
      }

      const role = obj?.role ?? obj?.author;
      const type = obj?.type;
      if (type === 'message' && role === 'user') {
        const texts = textsFromContent(obj?.content);
        for (const t of texts) {
          if (isEnvironmentContext(t)) {
            if (!cwd) {
              const c = extractCwd(t);
              if (c) cwd = c;
            }
          } else if (!ask) {
            // Normalize to single line for ask; leave full text trimming to formatter
            ask = t.replace(/\s+/g, ' ').trim();
          }
        }
      }

      if (opts.stopEarly !== false && cwd && ask) {
        break;
      }
    }
  } finally {
    rl.close();
    stream.close?.();
  }

  // Get mtime
  let mtime = 0;
  try {
    const st = await (await import('node:fs/promises')).stat(file);
    mtime = st.mtimeMs;
  } catch {}

  return { path: file, cwd, ask, mtime, timestamp };
};
