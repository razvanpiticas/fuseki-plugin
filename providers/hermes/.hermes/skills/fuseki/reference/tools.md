# The tools, in full

Every tool publishes its own input schema, and that schema is the authority on field names and
shapes — read it there rather than guessing. This file carries what a schema cannot say: which of
this server's two permissions each tool demands, whether it changes anything, and which
ProjectManagement permission the caller also needs for it to succeed.

**How to use them — which read comes before which write, how names become identifiers, what a
version is for — is the `fuseki-work` skill. Load that for any real work in a project.** This file
is the access map.

## Two permissions, two enforcement points

`mcp:tools.read` and `mcp:tools.write` are this server's own permissions, granted on Fuseki's roles
screen per tenant. They gate whether a tool may be *called*: every read tool demands the first,
every write tool the second, and nothing is anonymous.

For any tool that reaches ProjectManagement — which is every tool but `server_info` — that service
then enforces **its own** permissions on the forwarded token when the call arrives. So a caller
needs both. Being refused by ProjectManagement rather than by this server is the ordinary, correct
outcome for somebody who may use this server and may not use that data, and a refusal that names
ProjectManagement is not a bug here.

The two are granted separately and on different screens. A session where `list_projects` works and
`create_work_item` answers `FORBIDDEN` naming a ProjectManagement permission has the MCP write
permission and not the product one.

## Reads

| Tool | Changes state | ProjectManagement permission |
| --- | --- | --- |
| `server_info` | No | none — it touches no other service |
| `list_projects` | No | `project-management:projects.read` |
| `get_project` | No | `project-management:projects.read` |
| `get_project_vocabulary` | No | `project-management:workitems.read` and `project-management:projects.read` |
| `list_portfolios` | No | `project-management:portfolios.read` |
| `get_portfolio` | No | `project-management:portfolios.read` and `project-management:workitems.read` |
| `list_teams` | No | `project-management:projects.read` |
| `get_work_item` | No | `project-management:workitems.read` |
| `list_work_items` | No | `project-management:workitems.read` |
| `search_work_items` | No | `project-management:workitems.read` |
| `lookup_work_items` | No | `project-management:workitems.read` |
| `get_backlog` | No | `project-management:workitems.read` |
| `list_comments` | No | `project-management:workitems.read` |
| `list_work_item_links` | No | `project-management:workitems.read` |
| `list_sprints` | No | `project-management:workitems.read` |
| `get_sprint` | No | `project-management:workitems.read` |
| `preview_sprint_close` | No | `project-management:workitems.read` |
| `list_boards` | No | `project-management:workitems.read` |
| `get_board` | No | `project-management:workitems.read` |
| `get_product_vision` | No | `project-management:projects.read` |
| `list_skill_definitions` | No | `project-management:definitions.read` |
| `get_skill_definition` | No | `project-management:definitions.read` |
| `list_insights` | No | `project-management:definitions.read` |
| `get_insight` | No | `project-management:definitions.read` |

## Writes

| Tool | Changes state | ProjectManagement permission |
| --- | --- | --- |
| `start_change_set` | **Yes** | `project-management:workitems.write` |
| `complete_change_set` | **Yes** | `project-management:workitems.write` |
| `revert_change_set` | **Yes, and it takes work away** | `project-management:workitems.delete` |
| `create_project` | **Yes** | `project-management:projects.manage` |
| `update_project` | **Yes** | `project-management:projects.manage` |
| `archive_project` | **Yes** | `project-management:projects.manage` |
| `add_project_member` | **Yes** | `project-management:projects.manage` |
| `remove_project_member` | **Yes** | `project-management:projects.manage` |
| `save_product_vision` | **Yes, and it replaces the whole text** | `project-management:projects.configure` |
| `create_work_item` | **Yes** | `project-management:workitems.write` |
| `create_work_items` | **Yes** | `project-management:workitems.write` |
| `update_work_item` | **Yes** | `project-management:workitems.write` |
| `transition_work_item` | **Yes** | `project-management:workitems.write` |
| `change_work_item_type` | **Yes** | `project-management:workitems.write` |
| `change_work_item_parent` | **Yes** | `project-management:workitems.write` |
| `move_work_item` | **Yes** | `project-management:workitems.write` |
| `rebalance_backlog` | **Yes** | `project-management:workitems.write` |
| `set_work_item_labels` | **Yes** | `project-management:workitems.write` |
| `delete_work_item` | **Yes, and it takes work away** | `project-management:workitems.delete` |
| `restore_work_item` | **Yes** | `project-management:workitems.write` |
| `add_comment` | **Yes** | `project-management:workitems.write` |
| `link_work_items` | **Yes** | `project-management:workitems.write` |
| `unlink_work_items` | **Yes, and it takes work away** | `project-management:workitems.write` |
| `create_sprint` | **Yes** | `project-management:sprints.manage` |
| `update_sprint` | **Yes** | `project-management:sprints.manage` |
| `start_sprint` | **Yes** | `project-management:sprints.manage` |
| `close_sprint` | **Yes** | `project-management:sprints.manage` |
| `add_to_sprint` | **Yes** | `project-management:sprints.manage` |
| `remove_from_sprint` | **Yes** | `project-management:sprints.manage` |
| `record_skill_definition_insight` | **Yes** | `project-management:definitions.read` |
| `supersede_insight` | **Yes** | `project-management:definitions.read` |
| `contradict_insight` | **Yes** | `project-management:definitions.manage` |

Five permissions above are easy to be surprised by. Reverting a change set and deleting a work
item cost `workitems.delete` rather than `workitems.write`, so a role that can write everything and
delete nothing can open a run it cannot take back. Every sprint call costs `sprints.manage`, which
is not implied by `workitems.write`. A project write costs `projects.manage`, which is a separate
grant again, and saving the product vision costs `projects.configure`, which is another. And
recording a learning costs only `definitions.read`, so a member's session can record one, while
contradicting one costs `definitions.manage`, which a member does not hold.

## Skill definitions and learnings

A skill that follows a method fetches it with `get_skill_definition` when it runs, for its project,
and reads the instructions whole before acting. The answer names the level the text came from —
`Project`, `Organisation` or `Shipped`, the first that exists — and its version; quote both when
reporting what was followed. It carries no learnings: read them with `list_insights` only when the
person asks, before recording one, or when distilling.

Record a learning with `record_skill_definition_insight` only on the person's word, inside the
run's change set; it lands as a draft. `contradict_insight` is likewise only on the person's
answer. Nothing here customises, edits or removes a definition, and nothing approves, rejects or
applies a proposal: those are a person's, on the skill definitions screens, and the service refuses
them to an agent.

## The five tools that take a version

`update_work_item`, `transition_work_item`, `change_work_item_type`, `change_work_item_parent` and
`move_work_item` each take `expectedVersion` and answer with the version they produced. Nothing
else does — `set_work_item_labels` and `delete_work_item` look as though they should and do not,
because the routes beneath them read no precondition.

Read the item first with `get_work_item`, which answers the version; send that version; carry the
version the write answered into the next one. A refusal that names a version means somebody changed
the item in between, and it carries the item as it now stands so the decision can be made again.

## When the caller cannot see something

There is no "not found" here. A project, work item or sprint that does not exist and one the caller
is not allowed to see answer identically, and deliberately: telling the two apart would let anybody
map an organisation by being refused. A refusal that names neither a version nor an argument means
either that the thing is not there or that it is not yours, and the sentence it carries is
ProjectManagement's own.

The exception is a name this server could check itself — an item type, a workflow state, a label or
a relationship that is absent from the list it just read. Those are refused as `NOT_FOUND` with the
names that do exist, because there the server genuinely knows.
