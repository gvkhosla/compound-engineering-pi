# OpenCode Spec (Config, Agents, Plugins)

Last verified: 2026-01-21

## Primary sources

```
https://opencode.ai/docs/config
https://opencode.ai/docs/tools
https://opencode.ai/docs/permissions
https://opencode.ai/docs/plugins/
https://opencode.ai/docs/agents/
https://opencode.ai/config.json
```

## Config files and precedence

- OpenCode supports JSON and JSONC configs. citeturn10view0
- Config sources are merged (not replaced), with a defined precedence order from remote → global → custom → project → `.opencode` directories → inline overrides. citeturn10view0
- Global config is stored at `~/.config/opencode/opencode.json`, and project config is `opencode.json` in the project root. citeturn10view0
- Custom config file and directory can be provided via `OPENCODE_CONFIG` and `OPENCODE_CONFIG_DIR`. citeturn10view0
- The `.opencode` and `~/.config/opencode` directories use plural subdirectory names (`agents/`, `commands/`, `modes/`, `plugins/`, `skills/`, `tools/`, `themes/`), but singular names are also supported for backwards compatibility. citeturn10view0

## Core config keys

- `model` and `small_model` set the primary and lightweight models; `provider` configures provider options. citeturn10view0
- `tools` is still supported but deprecated; permissions are now the canonical control surface. citeturn1search0
- `permission` controls tool approvals and can be configured globally or per tool, including pattern-based rules. citeturn1search0
- `mcp`, `instructions`, and `disabled_providers` are supported config sections. citeturn1search5
- `plugin` can list npm packages to load at startup. citeturn1search2

## Tools

- OpenCode ships with built-in tools, and permissions determine whether each tool runs automatically, requires approval, or is denied. citeturn1search3turn1search0
- Tools are enabled by default; permissions provide the gating mechanism. citeturn1search3

## Permissions

- Permissions resolve to `allow`, `ask`, or `deny` and can be configured globally or per tool, with pattern-based rules. citeturn1search0
- Defaults are permissive, with special cases such as `.env` file reads. citeturn1search0
- Agent-level permissions override the global permission block. citeturn1search1turn1search0

## Agents

- Agents can be configured in `opencode.json` or as markdown files in `~/.config/opencode/agents/` or `.opencode/agents/`. citeturn1search1turn10view0
- Agent config supports `mode`, `model`, `temperature`, `tools`, and `permission`, and agent configs override global settings. citeturn1search1
- Model IDs use the `provider/model-id` format. citeturn1search1

## Plugins and events

- Local plugins are loaded from `.opencode/plugin/` (project) and `~/.config/opencode/plugin/` (global). npm plugins can be listed in `plugin` in `opencode.json`. citeturn1search2
- Plugins are loaded in a defined order across config and plugin directories. citeturn1search2
- Plugins export a function that returns a map of event handlers; the plugins doc lists supported event categories. citeturn1search2

## Notes for this repository

- Config docs describe plural subdirectory names, while the plugins doc uses `.opencode/plugin/`. This implies singular paths remain accepted for backwards compatibility, but plural paths are the canonical structure. citeturn10view0turn1search2
