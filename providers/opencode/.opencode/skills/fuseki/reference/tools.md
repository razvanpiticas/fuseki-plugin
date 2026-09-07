# The tools, in full

Every tool publishes its own input schema. Read it there rather than guessing at field names —
this file carries what the schema cannot say: which permission each tool demands, whether it
changes anything, and what it costs to call.

| Tool | Permission | Changes state | Reaches |
| --- | --- | --- | --- |
| `server_info` | `mcp:tools.read` | No | Nothing. Answers from the process itself |
| `list_items` | `mcp:tools.read` | No | In-memory list in this pod |
| `create_item` | `mcp:tools.write` | **Yes** | In-memory list in this pod |
| `demonstrate_refusal` | `mcp:tools.read` | No | Nothing |
| `project_management_health` | `mcp:tools.read` | No | ProjectManagement, over HTTP |

None of them is anonymous. Every one requires a signed-in caller who belongs to a tenant, because
the permission policy carries the tenant requirement with it.

## Arguments

**`server_info`** — none. Returns the deployment name, the route it serves and the tool names it
publishes. When its tool list disagrees with a skill or a document, the tool list is right.

**`list_items`** — `limit`, an integer between 1 and 100, defaulting to 20 when omitted. Returns
the items ordered by name with the id, name and note of each.

**`create_item`** — `name`, 1 to 80 characters, and optional `note` free text. The name must be
free across the whole list: calling twice with the same name fails the second time and names the
argument at fault. Returns the created item.

**`demonstrate_refusal`** — `mode`, one of `invalid_argument`, `not_found`, `conflict`,
`forbidden`, `upstream_unavailable`, `misconfigured`. Returns the matching refusal. An unknown mode
is itself refused as an invalid argument. Reads nothing, writes nothing, affects no other call.

**`project_management_health`** — none. Reports whether this server reached ProjectManagement and
was accepted by it, and the address it used. A failure says whether the problem is reachability or
credentials, which is worth knowing before blaming any other tool.

## Two permissions, two enforcement points

`mcp:tools.read` and `mcp:tools.write` are this server's own permissions, granted on Fuseki's roles
screen per tenant. They gate whether a tool may be *called*.

For any tool that reaches ProjectManagement, that service then enforces **its own** permissions on
the forwarded token when the call arrives. So a caller needs both, and being refused by
ProjectManagement rather than by this server is the ordinary, correct outcome for somebody who may
use this server and may not use that data. A refusal that names ProjectManagement is not a bug in
this server.

## What is scaffolding

`list_items`, `create_item` and `demonstrate_refusal` are the samples the server was generated
with. `list_items` and `create_item` share one in-memory dictionary that empties whenever the pod
restarts, so an empty list is the normal state after a deploy, not a data loss.

They are being replaced by tools against ProjectManagement's real surface. Until they are, do not
build anything on the item list, and do not describe it to a user as Fuseki data.
