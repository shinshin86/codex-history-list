export type SessionSummary = {
  path: string;
  cwd?: string;
  ask?: string;
  mtime: number; // epoch ms
  timestamp?: string; // ISO if available in file
};

export type ParseOptions = {
  stopEarly?: boolean; // stop when cwd and ask found
};

