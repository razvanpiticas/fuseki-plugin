---
name: fuseki
description: Connects to and drives the Fuseki MCP server at mcp.fuseki.dev — project management data, tenant-scoped, under the caller's own permissions. Use when working with Fuseki projects, work items or teams, when a Fuseki tool refuses a call, or when connecting a harness to the Fuseki server.
---

# Fuseki

Fuseki's MCP server fronts the product's ProjectManagement service. It holds no database of its
own: every tool call is an HTTP call to a service that already enforces the product's own rules,
made **as the person using the model** rather than as a service account.

That is the fact everything else follows from. The server never sees more than the caller does, so
a tool that refuses is usually reporting the caller's own access rather than a fault.

## Connecting

The server is declared under `mcp_servers` in `~/.hermes/config.yaml`.

Sign-in is OAuth against the Keycloak realm at `keycloak.quantarcane.io`, using the public client
`fuseki-public-client` and the loopback callback on port `8123`. Both halves are fixed: a different
port is a redirect-uri mismatch, not a preference.

**Call `server_info` first when anything is wrong.** It answers without touching any downstream
service, so it separates "the server is unreachable or I am not signed in" from "the server is fine
and the call was refused".

## What access means here

Two permissions gate everything:

| Permission | Covers |
| --- | --- |
| `mcp:tools.read` | Every tool that only reads |
| `mcp:tools.write` | Every tool that changes something |

They are granted through Fuseki's own roles screen, per tenant, like every other permission in the
product. A session where reads succeed and writes answer 403 is a role problem, not a connection
problem — and re-authenticating does not fix it, because the token has to be minted again *after*
the role is granted.

Every call is also tenant-scoped from the caller's token. A caller who belongs to no tenant gets
403 on everything, which is correct rather than broken.

## The tools

| Tool | One line |
| --- | --- |
| `server_info` | What this deployment is and what it can reach. Touches nothing else |
| `list_items` | Reads the item list |
| `create_item` | Adds one item |
| `project_management_health` | Proves this server can reach ProjectManagement and be accepted by it |

Read [reference/tools.md](reference/tools.md) before the first call in a session — it carries the
argument shapes and which tools change state.

> **These are the tools the server was generated with, not Fuseki's product surface.** They are
> scaffolding, they are being replaced as ProjectManagement's real capabilities are wired up, and
> `list_items` in particular reads an in-memory list that empties whenever the pod restarts. If the
> table above disagrees with what `server_info` reports, `server_info` is right and this file is
> stale — say so rather than working around it.

## Reading a refusal

A refused call names the arguments at fault and says whether retrying is worth anything. Read it
rather than resending the same call.

- **The refusal names an argument** — fix the argument and retry once.
- **The refusal is a 403** — a permission or tenant problem. Retrying cannot fix it. Tell the user
  which permission is missing.
- **The refusal is a 401** — the token expired or was never minted. Sign in again.
- **The refusal says a downstream holds nothing at that address** — the server reached
  ProjectManagement and got a 404. That is a server-side routing fault, not a bad argument.

A refusal that fits none of these is worth a question rather than a second attempt.
Ask the user directly to clarify what you cannot infer.

`demonstrate_refusal` fails on purpose and changes nothing, so it is safe to call when you want to
see the refusal shape before relying on it.

For symptoms that survive a retry, read
[reference/troubleshooting.md](reference/troubleshooting.md).

## Rules that are easy to get wrong

**Never invent a tenant.** No tool takes a tenant argument, and none should — the tenant comes from
the token. A call that appears to need one is a sign the wrong tool was chosen.

**Do not cache what `list_items` returns across turns.** It reads live state that another person in
the same tenant can change between calls.

**A write is not confirmed until the tool says so.** `create_item` returns the created item; if the
call refused, nothing was written, and reporting otherwise to the user is worse than reporting the
failure.
