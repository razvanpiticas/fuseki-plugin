---
name: fuseki
description: Connects to and drives the Fuseki MCP server at mcp.fuseki.dev — project management data, tenant-scoped, under the caller's own permissions. Use when connecting a harness to Fuseki, when sign-in or a connection is failing, when a Fuseki tool refuses a call and the refusal needs reading, or when somebody asks what access they have. For actually reading or writing a project's work — creating items, splitting an epic, moving something through a workflow, running a sprint — load the fuseki-work skill, which this one hands off to.
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
`fuseki-agent-client` and the loopback callback on port `8123`. Both halves are fixed: a different
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

Sixty-one, in families. `list_` and `get_` read; `create_`, `add_`, `record_` and `observe_`
create; `update_` and `save_` edit; `transition_`, `change_`, `move_`, `set_`, `start_`, `close_`,
`restore_`, `supersede_` and `contradict_` change state; `delete_`, `remove_` and `revert_` take
something away.

| Family | Tools |
| --- | --- |
| This deployment | `server_info` |
| Projects and portfolios | `list_projects`, `get_project`, `get_project_vocabulary`, `list_portfolios`, `get_portfolio`, `list_teams`, `get_product_vision`, `create_project`, `update_project`, `archive_project`, `add_project_member`, `remove_project_member`, `save_product_vision` |
| Work items | `get_work_item`, `list_work_items`, `search_work_items`, `lookup_work_items`, `create_work_item`, `create_work_items`, `update_work_item`, `transition_work_item`, `change_work_item_type`, `change_work_item_parent`, `move_work_item`, `rebalance_backlog`, `set_work_item_labels`, `delete_work_item`, `restore_work_item` |
| Backlog, sprints and boards | `get_backlog`, `list_sprints`, `get_sprint`, `preview_sprint_close`, `list_boards`, `get_board`, `create_sprint`, `update_sprint`, `start_sprint`, `close_sprint`, `add_to_sprint`, `remove_from_sprint` |
| Conversation and links | `list_comments`, `add_comment`, `list_work_item_links`, `link_work_items`, `unlink_work_items` |
| Runs and taking them back | `list_change_sets`, `get_change_set`, `start_change_set`, `observe_change_set`, `complete_change_set`, `revert_change_set` |
| Routines | `list_routines`, `get_routine` |
| Skill definitions and what was learned | `list_skill_definitions`, `get_skill_definition`, `list_insights`, `get_insight`, `record_skill_definition_insight`, `supersede_insight`, `contradict_insight` |

**There is no tool named after a kind of work item.** Fuseki has no Epic, Feature, Story or Task
entity — a work item's kind is a row an organisation edits — so the call is
`create_work_item` with the kind named as an argument, and `get_project_vocabulary` answers which
kinds this organisation actually has.

The permission each tool demands, whether it changes anything, and which of the five take a version
are in [reference/tools.md](reference/tools.md). Read it before the first call in a session.

**How to use them is the `fuseki-work` skill: which read comes before which write, how a name
becomes the identifier a write needs, what a version protects, and how to make a run revertible.
Load it for any read or write against a project's work.** This skill stops at the connection and
what a refusal means.

## Reading a refusal

Every refusal carries a code, a sentence saying what happened, the arguments at fault, and a
recovery saying whether retrying is worth anything. Do what the recovery says rather than resending.

- **`INVALID_ARGUMENT`** — an argument cannot be used as sent, and the refusal names which. Nothing
  was read and nothing was changed. Fix it and call again.
- **`NOT_FOUND`** — a name matched nothing in a list the server had just read: an item type, a
  workflow state, a label, a relationship, a portfolio key. The refusal lists the names that do
  exist, so the correction is in your hand.
- **`CONFLICT`** — two different things, told apart by whether it names a version. Naming one means
  somebody changed the item after you read it, and the refusal carries the item as it now stands;
  naming none means either a rule of the project refuses the change or nothing you can see answers
  to the name you gave. Fuseki deliberately does not distinguish those two, so that being refused
  cannot be used to learn what exists.
- **`FORBIDDEN`** — about who is asking, not about what was asked. Either the signed-in person is
  missing a ProjectManagement permission — the tool's own description names which one — or the
  organisation is in read-only mode because its plan lapsed, which the refusal says outright.
  Retrying cannot fix either, and a different argument will not help. Report which it is.
- **`SERVER_MISCONFIGURED`** — the credential was not accepted at all, or the server hit something
  it did not anticipate. Not about your call. Sign in again if the session has been running a long
  time; otherwise report it.
- **`UPSTREAM_UNAVAILABLE`** — a service this server depends on did not answer. This is the one code
  whose recovery invites a single retry.

A refusal that fits none of these is worth a question rather than a second attempt.
Ask the user directly to clarify what you cannot infer.

**A `FORBIDDEN` on a write when reads succeed is a role problem and not a connection problem**, and
re-authenticating does not fix it: the token has to be minted again *after* the role is granted.

For symptoms that survive a retry, read
[reference/troubleshooting.md](reference/troubleshooting.md).

## Rules that are easy to get wrong

**Never invent a tenant.** No tool takes a tenant argument, and none should — the tenant comes from
the token. A call that appears to need one is a sign the wrong tool was chosen.

**Do not cache what a read answered across turns.** Every read is live state that another person in
the same organisation can change between calls, and a work item's version in particular is stale the
moment somebody else writes.

**A write is not confirmed until the tool answers with the row.** Report what came back, by
reference code, never what you intended — a refusal changed nothing unless its message says
otherwise, and telling somebody an item exists when it does not is worse than reporting the failure.

**`server_info` is the authority on what this deployment offers.** When its tool list disagrees with
this file or with any other document, the tool list is right and the document is stale — say so
rather than working around it.
