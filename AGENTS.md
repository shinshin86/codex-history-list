# Repository Guidelines

## Project Structure & Module Organization
- `src/`: TypeScript sources.
  - `cli.ts`: CLI entrypoint (args, table/JSON output).
  - `scan.ts`: Recursive finder for `~/.codex/sessions/**/*.jsonl` and `mtime`.
  - `parse.ts`: Line‑by‑line JSONL parser; extracts `cwd`, first user ask, and optional `timestamp`.
  - `types.ts`: Shared types.
- `dist/`: Build output from `tsup` (ignored by Git). Do not commit.
- `package.json`, `tsconfig.json`, `README.md`, `LICENSE`.

## Build, Test, and Development Commands
- Install: `npm i` (Node 18+).
- Build: `npm run build` → emits ESM to `dist/` via `tsup`.
- Watch: `npm run dev` → rebuild on change.
- Type check: `npm run typecheck` (no emit).
- Lint: `npm run lint` (requires ESLint to be installed/configured).
- Run CLI: `node dist/cli.js --help` or e.g. `node dist/cli.js --json --no-color`.

## Coding Style & Naming Conventions
- Language: TypeScript + ESM. Keep local imports with `.js` extensions (even in `.ts`).
- Indentation: 2 spaces; use semicolons; prefer `const` and arrow functions.
- Naming: `camelCase` for vars/functions, `PascalCase` for types, filenames lowercase (use dashes if multiple words).
- Exports: prefer named exports. Handle wide characters with `string-width` where relevant.

## Testing Guidelines
- No test runner is configured yet. If adding tests, use Node’s built‑in test runner or Vitest.
- Location: `tests/` or `src/**/__tests__/**`.
- Naming: `*.test.ts` or `*.spec.ts`.
- Tips: use `--no-color` and `--json` for stable snapshots; cover parsing of `<environment_context>`/`<cwd>` and table truncation logic.

## Commit & Pull Request Guidelines
- Style: follow Conventional Commits (e.g., `fix(cli): align path column`, `docs(readme): add sample output`).
- PR checklist:
  - Clear description and rationale; include example CLI output (before/after) when UI changes.
  - Link related issues; keep diffs focused; update README/AGENTS when behavior or options change.
  - Ensure `npm run typecheck` and `npm run build` succeed; do not commit `dist/`.

## Security & Configuration Tips
- This CLI only reads local session files; never write to `~/.codex/sessions`.
- Fail gracefully on unreadable files; avoid loading entire files into memory; keep errors non‑verbose by default.

