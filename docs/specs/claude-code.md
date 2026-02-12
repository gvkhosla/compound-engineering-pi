# Claude Code Plugin Spec

Last verified: 2026-01-21

## Primary sources

```
https://docs.claude.com/en/docs/claude-code/plugins-reference
https://docs.claude.com/en/docs/claude-code/hooks
https://docs.claude.com/en/docs/claude-code/slash-commands
https://docs.claude.com/en/docs/claude-code/skills
https://docs.claude.com/en/docs/claude-code/plugin-marketplaces
```

## Plugin layout and file locations

- A plugin root contains `.claude-plugin/plugin.json` and optional default directories like `commands/`, `agents/`, `skills/`, `hooks/`, plus `.mcp.json` and `.lsp.json` at the plugin root. citeturn2view7
- The `.claude-plugin/` directory only holds the manifest; component directories (commands/agents/skills/hooks) must be at the plugin root, not inside `.claude-plugin/`. citeturn2view7
- The reference table lists default locations and notes that `commands/` is the legacy home for skills; new skills should live under `skills/<name>/SKILL.md`. citeturn2view7

## Manifest schema (`.claude-plugin/plugin.json`)

- `name` is required and must be kebab-case with no spaces. citeturn2view8
- Metadata fields include `version`, `description`, `author`, `homepage`, `repository`, `license`, and `keywords`. citeturn2view8
- Component path fields include `commands`, `agents`, `skills`, `hooks`, `mcpServers`, `outputStyles`, and `lspServers`. These can be strings or arrays, or inline objects for hooks/MCP/LSP. citeturn2view8turn2view9
- Custom paths supplement defaults; they do not replace them, and all paths must be relative to the plugin root and start with `./`. citeturn2view9

## Commands (slash commands)

- Command files are Markdown with frontmatter. Supported frontmatter includes `allowed-tools`, `argument-hint`, `description`, `model`, and `disable-model-invocation`, each with documented defaults. citeturn6search0

## Skills (`skills/<name>/SKILL.md`)

- Skills are directories containing `SKILL.md` (plus optional support files). Skills and commands are auto-discovered when the plugin is installed. citeturn2view7
- Skills can be invoked with `/<skill-name>` and are stored in `~/.claude/skills` or `.claude/skills` (project-level); plugins can also ship skills. citeturn12view0
- Skill frontmatter examples include `name`, `description`, and optional `allowed-tools`. citeturn12view0

## Agents (`agents/*.md`)

- Agents are markdown files with frontmatter such as `description` and `capabilities`, plus descriptive content for when to invoke the agent. citeturn2view7

## Hooks (`hooks/hooks.json` or inline)

- Hooks can be provided in `hooks/hooks.json` or inline via the manifest. Hooks are organized by event → matcher → hook list. citeturn2view7
- Plugin hooks are merged with user and project hooks when the plugin is enabled, and matching hooks run in parallel. citeturn1search0
- Supported events include `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`, `UserPromptSubmit`, `Notification`, `Stop`, `SubagentStart`, `SubagentStop`, `Setup`, `SessionStart`, `SessionEnd`, and `PreCompact`. citeturn2view7
- Hook types include `command`, `prompt`, and `agent`. citeturn2view7
- Hooks can use `${CLAUDE_PLUGIN_ROOT}` to reference plugin files. citeturn1search0

## MCP servers

- Plugins can define MCP servers in `.mcp.json` or inline under `mcpServers` in the manifest. Configuration includes `command`, `args`, `env`, and `cwd`. citeturn2view7turn2view10
- Plugin MCP servers start automatically when enabled and appear as standard MCP tools. citeturn2view10

## LSP servers

- LSP servers can be defined in `.lsp.json` or inline in the manifest. Required fields include `command` and `extensionToLanguage`, with optional settings for transport, args, env, and timeouts. citeturn2view7turn2view10

## Plugin caching and path limits

- Claude Code copies plugin files into a cache directory instead of using them in place. Plugins cannot access paths outside the copied root (for example, `../shared-utils`). citeturn2view12
- To access external files, use symlinks inside the plugin directory or restructure your marketplace so the plugin root contains shared files. citeturn2view12

## Marketplace schema (`.claude-plugin/marketplace.json`)

- A marketplace JSON file lists plugins and includes fields for marketplace metadata and a `plugins` array. citeturn8view2
- Each plugin entry includes at least a `name` and `source` and can include additional manifest fields. citeturn8view2
