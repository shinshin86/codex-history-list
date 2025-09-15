# codex-history-list

Small CLI to list Codex session histories stored under `~/.codex/sessions`.
It parses JSONL files, extracts the working directory (cwd) from
`<environment_context>` messages and the first user request, and shows them in
an aligned table together with the file path.

You can resume a conversation from where you left off by launching Codex with the path to the session JSONL as shown below.

```sh
codex -c experimental_resume={jsonl path}
```

## Sample Output

```
time              cwd                                                 ask                                       path
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
2025-08-31 17:06  /Users/you/projects/…/alpha                        Implement feature flag rollout strateg…   /Users/you/.codex/sessions/2025/08/31/rollout-2025-08-31T17-06-00-aaaa-bbbb-cccc-dddd.jsonl
2025-08-31 16:49  /Users/you/dev/…/packages/app                      Refactor modules to arrow functions ac…   /Users/you/.codex/sessions/2025/08/31/rollout-2025-08-31T16-49-44-1111-2222-3333-4444.jsonl
2025-08-31 16:02  -                                                   -                                         /Users/you/.codex/sessions/2025/08/31/rollout-2025-08-31T16-02-10-a1b2-c3d4-e5f6-7890.jsonl
2025-08-31 15:10  /Users/you/work/…/delta                            Add unit tests for scanner and parser     /Users/you/.codex/sessions/2025/08/31/rollout-2025-08-31T15-10-59-dead-beef-cafe-babe.jsonl
2025-08-31 14:55  /Users/you/src/…/epsilon                           Investigate performance regression in p…   /Users/you/.codex/sessions/2025/08/31/rollout-2025-08-31T14-55-23-9abc-def0-1234-5678.jsonl
2025-08-31 14:12  /Users/you/repos/…/zeta                            Doc update: README sample output table …   /Users/you/.codex/sessions/2025/08/31/rollout-2025-08-31T14-12-45-0246-8ace-1357-9bdf.jsonl
2025-08-31 13:01  /Users/you/projects/…/eta                          Chore: lint, format, fix types            /Users/you/.codex/sessions/2025/08/31/rollout-2025-08-31T13-01-12-aaaa-0000-bbbb-1111.jsonl
2025-08-30 22:47  /Users/you/projects/…/theta                        Spike: streaming JSONL reader backpress…  /Users/you/.codex/sessions/2025/08/30/rollout-2025-08-30T22-47-33-ffff-eeee-dddd-cccc.jsonl
```

## Features

- Fast recursive scan of `~/.codex/sessions` for `.jsonl` files
- Robust JSONL parsing (line-by-line, tolerant of mixed shapes)
- Extracts:
  - cwd from `<environment_context>` (`<cwd>...</cwd>`) in user messages
  - the first user ask (excluding environment context and instruction/meta blocks like `<user_instructions>`, `<system_instructions>`, `<developer_instructions>`, `<assistant_instructions>`, `<agent_instructions>`)
- Aligned columns with multi‑byte aware width handling
- Path column prioritized for copy-paste; truncated only as a last resort
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
  characters and emojis; `cwd` uses center‑ellipsis (`start…end`), `ask` uses right‑ellipsis.
- Time source: sorts by file `mtime` by default; if `--sort timestamp` is set
  and a top-level `timestamp` exists in the file, that value is used for
  sorting/filtering, otherwise falls back to `mtime`.

## Notes

- JSONL expectations:
  - Lines with `{ "record_type": "state" }` are ignored.
  - User messages are recognized via `{ type: "message", role: "user" }`.
  - `content` may be a string or an array containing `{ type, text }` objects.
  - `cwd` is parsed from user messages whose text starts with `<environment_context>`.
- Ask selection:
  - Texts starting with `<environment_context>` are used only to extract `cwd` and are not considered as the ask.
  - Instruction/meta blocks starting with `<user_instructions>`, `<system_instructions>`, `<developer_instructions>`, `<assistant_instructions>`, or `<agent_instructions>` are ignored when selecting the ask.
  - The ask is the first remaining user message text, normalized to a single line.
- Performance:
  - Files are read line-by-line and parsing stops early once both `cwd` and
    the first user ask are found.
  - Parsing runs concurrently across multiple files.

## Troubleshooting

- No rows shown: verify the directory with `--dir` and that it contains `.jsonl` files.
- Misaligned output: try a wider terminal or disable colors with `--no-color`.
- Wrong time ordering: ensure files have a `timestamp` if using `--sort timestamp`;
  otherwise ordering uses file `mtime`.
