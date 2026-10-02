# Fuseki agent plugin

Connects your coding agent to the Fuseki MCP server at `https://mcp.fuseki.dev` — project
data, tenant-scoped, under your own permissions rather than a service account's.

**This repository is generated.** Every file in it is build output from the Fuseki monorepo. Edits
here are overwritten by the next publish; open a change against the source instead.

## Install

Claude Code:

```
/plugin marketplace add razvanpiticas/fuseki-plugin
/plugin install fuseki@fuseki-plugins
```

Codex:

```
codex plugin marketplace add razvanpiticas/fuseki-plugin
codex plugin add fuseki@fuseki-plugins
```

Cursor, Gemini CLI, OpenCode, OpenClaw, Hermes — run this in your project:

```
pnpm dlx github:razvanpiticas/fuseki-plugin install
```

It detects which of those harnesses you have, writes the skill and the server declaration, and
prints anything it will not write for you.

Any other MCP client: add `https://mcp.fuseki.dev/mcp` and set the OAuth client id to
`fuseki-agent-client`.

## After installing

Sign in when prompted, then ask your agent to call the `server_info` tool. It answers with the
deployment name and the tools it publishes, and it touches nothing else — so it is the one call
worth making first when something is not working.

Access is granted on Fuseki's own roles screen, per tenant: `mcp:tools.read` and `mcp:tools.write`.
Reads working while writes answer 403 means the write permission has not been granted, or the
token predates the grant.

Version 0.6.0+e2056eb2fe19.
