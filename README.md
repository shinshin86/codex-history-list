# codex-history-list

Small CLI to list Codex session histories stored under `~/.codex/sessions`.
It parses JSONL files, extracts the working directory (cwd) from
`<environment_context>` messages and the first user request, and shows them in
an aligned table together with the file path.

## Features

- Fast recursive scan of `~/.codex/sessions` for `.jsonl` files
- Robust JSONL parsing (line-by-line, tolerant of mixed shapes)
- Extracts:
  - cwd from `<environment_context>` (`<cwd>...</cwd>`) in user messages
  - the first user ask (excluding environment context)
- Aligned columns with multi‑byte aware width handling
- Full, non-truncated path column for easy copy-paste
- Sorting and filtering by date and cwd
- JSON output for scripting

## Install / Build

This project is intended for local use (not published to npm).

```
npm i
npm run build
```

## Usage

```
node dist/cli.js --help
node dist/cli.js
node dist/cli.js --dir ~/.codex/sessions --limit 20
node dist/cli.js --sort timestamp --order asc --since 2025-08-01 --before 2025-09-01
node dist/cli.js --cwd-filter /Users/you/projects/foo
node dist/cli.js --json
```

## Options

- `--dir <path>`: Session directory (default: `~/.codex/sessions`).
- `--limit <n>`: Limit number of rows displayed.
- `--json`: Output machine-readable JSON instead of a table.
- `--no-color`: Disable colored output.
- `--sort <key>`: `mtime` or `timestamp` (default: `mtime`).
- `--order <dir>`: `asc` or `desc` (default: `desc`).
- `--since <time>` / `--before <time>`: Filter by date/time (ISO like `2025-08-30`).
- `--cwd-filter <substr>`: Only show rows whose cwd contains the substring.

## Output Format

- Columns: `time` | `cwd` | `ask` | `path`.
- Alignment: `time`, `cwd`, and `ask` are fixed-width and aligned; `path` is
  shown in full (no truncation) for easy copy/paste.
- Width handling: uses display width to align properly with Japanese/full‑width
  characters and emojis; long `cwd`/`ask` are safely truncated with `…`.
- Time source: sorts by file `mtime` by default; if `--sort timestamp` is set
  and a top-level `timestamp` exists in the file, that value is used for
  sorting/filtering, otherwise falls back to `mtime`.

## Notes

- JSONL expectations:
  - Lines with `{ "record_type": "state" }` are ignored.
  - User messages are recognized via `{ type: "message", role: "user" }`.
  - `content` may be a string or an array containing `{ type, text }` objects.
  - `cwd` is parsed from user messages whose text starts with `<environment_context>`.
- Performance:
  - Files are read line-by-line and parsing stops early once both `cwd` and
    the first user ask are found.
  - Parsing runs concurrently across multiple files.

## Troubleshooting

- No rows shown: verify the directory with `--dir` and that it contains `.jsonl` files.
- Misaligned output: try a wider terminal or disable colors with `--no-color`.
- Wrong time ordering: ensure files have a `timestamp` if using `--sort timestamp`;
  otherwise ordering uses file `mtime`.
