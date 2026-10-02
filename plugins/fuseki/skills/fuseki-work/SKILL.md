---
name: fuseki-work
description: Reads and writes a Fuseki project's work through the Fuseki MCP tools — projects, work items and their hierarchy, the backlog, sprints, boards, comments, links and the change set that makes a run revertible. Use this whenever a task touches project work in any way, even if the user never says Fuseki — writing a backlog item, splitting an epic into features, reparenting or ranking something, moving work through a workflow, planning or closing a sprint, typing the links the embedder drew, finding related work, reading the Fuseki glossary, or reading what a project already holds. Every later method skill writes through this one.
argument-hint: <project key or name> <what to read or write>
allowed-tools: Bash(date *), mcp__fuseki__server_info, mcp__fuseki__list_projects, mcp__fuseki__get_project, mcp__fuseki__get_project_vocabulary, mcp__fuseki__list_portfolios, mcp__fuseki__get_portfolio, mcp__fuseki__list_teams, mcp__fuseki__get_work_item, mcp__fuseki__list_work_items, mcp__fuseki__search_work_items, mcp__fuseki__lookup_work_items, mcp__fuseki__get_backlog, mcp__fuseki__list_comments, mcp__fuseki__list_work_item_links, mcp__fuseki__get_similar_work_items, mcp__fuseki__get_neighbours, mcp__fuseki__get_dependencies, mcp__fuseki__run_analytical_query, mcp__fuseki__list_untyped_links, mcp__fuseki__list_sprints, mcp__fuseki__get_sprint, mcp__fuseki__preview_sprint_close, mcp__fuseki__list_boards, mcp__fuseki__get_board, mcp__fuseki__get_product_vision, mcp__fuseki__list_skill_definitions, mcp__fuseki__get_skill_definition, mcp__fuseki__list_insights, mcp__fuseki__get_insight, mcp__fuseki__list_routines, mcp__fuseki__get_routine, mcp__fuseki__get_change_set, mcp__fuseki__list_change_sets, mcp__fuseki__start_change_set, mcp__fuseki__observe_change_set, mcp__fuseki__complete_change_set, mcp__fuseki__revert_change_set, mcp__fuseki__create_project, mcp__fuseki__update_project, mcp__fuseki__archive_project, mcp__fuseki__add_project_member, mcp__fuseki__remove_project_member, mcp__fuseki__save_product_vision, mcp__fuseki__create_work_item, mcp__fuseki__create_work_items, mcp__fuseki__update_work_item, mcp__fuseki__transition_work_item, mcp__fuseki__change_work_item_type, mcp__fuseki__change_work_item_parent, mcp__fuseki__move_work_item, mcp__fuseki__rebalance_backlog, mcp__fuseki__set_work_item_labels, mcp__fuseki__delete_work_item, mcp__fuseki__restore_work_item, mcp__fuseki__add_comment, mcp__fuseki__link_work_items, mcp__fuseki__unlink_work_items, mcp__fuseki__type_link, mcp__fuseki__create_sprint, mcp__fuseki__update_sprint, mcp__fuseki__start_sprint, mcp__fuseki__close_sprint, mcp__fuseki__add_to_sprint, mcp__fuseki__remove_from_sprint, mcp__fuseki__record_skill_definition_insight, mcp__fuseki__supersede_insight, mcp__fuseki__contradict_insight
---

# Fuseki work

A Fuseki project holds work items of the kinds that organisation has defined, arranged in a tree and
ordered in a backlog, moving through a workflow, optionally gathered into sprints and drawn on
boards. Every tool call is made as the signed-in person inside their own organisation — the
connection and sign-in are the `fuseki` skill's job; this skill is about what to write and how.

**There is no Epic, Feature, Story or Task in Fuseki.** A work item's kind is a row an organisation
edits, so the call is always `create_work_item` with the kind named as an argument, and an
organisation may have kinds nobody else has. Never assume a kind exists — read it.

## The glossary comes first

Fuseki's words — work item, reference code, change set, link, link word, untyped link, possible
duplicate, passage, verdict, skill definition, insight, routine and the rest — are one short file on
the server, the resource `fuseki://glossary`. It is a resource, not a tool: no tool is named after it.
Read it once per session, before the first search, the first link read and the first link typed, so
a question is asked in the product's words and an answer is read in them. Already read in this
session: do not read it again.
Here, `ListMcpResourcesTool` lists it under the Fuseki server, and `ReadMcpResourceTool` reads it
with that server's name and uri `fuseki://glossary`. The server is `plugin:fuseki:fuseki` when it
came with this plugin, and `fuseki` when it was added by hand. That call is this step.

## The loop every write follows

1. **Find the project.** `list_projects` answers what the caller can see, with the key each is
   addressed by. `get_project` reads one.
2. **Read the vocabulary.** `get_project_vocabulary` answers, in one call, the kinds of work item
   this organisation offers with the level each sits at, the workflow states each kind can be in
   here, the labels, the custom fields, the teams and the project's members. This is the call that
   makes a write possible: everything else you write is named from it.
3. **Read the thing you are about to change.** `get_work_item` answers the item **and the version it
   is at**. An edit decided without reading is an edit decided on what you remember rather than on
   what is there.
4. **Write against the version you read.** The five editing tools take `expectedVersion` and answer
   with the version they produced. Carry that into the next write on the same item.
5. **Report what the tool answered, by reference code** (`FUS-142`), never what you intended. A
   refusal changed nothing unless its message says otherwise.

## Names in, identifiers out

You name things; the server resolves them. `itemTypeName`, `workflowStateName`, `labelNames`,
`linkTypeName` and `parentReferenceCode` are all names or codes, and every one is matched against
what `get_project_vocabulary` or a read answered — case-insensitively, and refused with the list of
what does exist when nothing matches. **Never invent an identifier and never invent a name**: a
`NOT_FOUND` naming your argument is a list of the alternatives, so it costs one round trip.

Projects are addressed by key (`FUS`), work items by reference code (`FUS-142`), sprints and boards
by the identifier a listing answered.

## The hierarchy is one level at a time

A parent sits **exactly one level above** its child — never two. If Epic is level 1, Feature 2 and
Story 3, then a Story cannot hang directly from an Epic; a Feature has to exist between them.
`get_project_vocabulary` answers every kind's `hierarchyLevel`, so the check is arithmetic you can
do before writing rather than a refusal you read afterwards. `change_work_item_parent` and
`change_work_item_type` both meet this rule from opposite ends: changing a kind can orphan a
subtree, and changing a parent can be refused by a kind you did not touch.

`change_work_item_parent` with no parent named detaches the item entirely.

## Versions, and what they protect

Five tools take `expectedVersion` and answer a new one: `update_work_item`,
`transition_work_item`, `change_work_item_type`, `change_work_item_parent` and `move_work_item`.
**`set_work_item_labels` and `delete_work_item` do not** — those routes read no precondition, so
there is no protection to ask for and none is offered.

A `CONFLICT` naming a version means somebody wrote between your read and your write. The refusal
carries the item **as it now stands** and the version that won, so re-read nothing: decide again
from what the refusal handed you, then write against that version. Resending the same change is how
you overwrite somebody's work with a decision made before it existed.

## Change sets: making a run revertible

A run that writes more than once opens a change set first, and every call in it says which run it
belongs to:

- `start_change_set(summary, projectKey)` opens it. Name the project it works on, so the runs screen
  lists the run under that project; `routineId` only when a routine's schedule fired the run — a
  person asking is not a routine. It answers an id: pass it as `changeSetId` on every write in the run.
  The summary names the run and the moment it opens, taken with `date -u "+%Y-%m-%d %H:%M:%S"`:
  the same summary on the same project within thirty days is read as the same request and answers
  the change set that request opened, even a finished one. A write refused because its change set is
  no longer running wrote nothing: open a new one, with a new moment.
- `observe_change_set(changeSetId, note)` records what the run noticed on the way that no write
  shows — a decision taken, a dead end, a step done — in one sentence, as it happens.
- `complete_change_set(changeSetId, outcome, …)` ends it, with one of two outcomes: `Completed` and
  a summary of what the run did, or `Failed` and the reason it could not be carried out. Work done that
  the person then disliked is `Completed`; `Failed` is for a run that could not do its work. Nothing
  else is accepted: cancelling is the person's act, on the runs screen.

A run that turned out wrong — the wrong four features under the wrong epic — is then one
`revert_change_set` away from never having happened.

**A change set that wrote work items is typed before it completes.** Whichever skill opened it
runs `fuseki-linker` with the project key and that change set's id just before its
`complete_change_set`, and puts the lines the linker hands back into its own report. The embedder may
not have drawn every link yet; the linker types what is there, and the Weekly linker catches the rest.

`revert_change_set` is **refused while the run is still running**, because undoing it now would
leave behind whatever the run writes next. End it first. It takes back what the run created and puts
back what it changed, and it answers both lists.

## Finding a work item: one tool per job

| You have | Call | Not this |
| --- | --- | --- |
| The reference code | `get_work_item` | — it is the only one that answers the version |
| A project and a filter (kind, state, assignee) | `list_work_items` | it cannot order by rank |
| A description of what the work is *about* | `search_work_items` | not the type-ahead; not project-scoped; spends the embedding allowance |
| Part of a code or title, in one project | `lookup_work_items` | not the search; it will not find by meaning |
| An item, and you want what reads like it | `get_similar_work_items` | spends nothing; answers while search by meaning is off |
| An item, and you want what is joined to it | `list_work_item_links` one hop, `get_neighbours` up to three | — |
| An item, and you want what must finish first | `get_dependencies` | never decide an item can start from its links alone |
| A question that names a shape of more than one hop (what blocks what blocks an item; the stories under an epic blocked from another project) | `run_analytical_query` | not `get_dependencies`, which answers the whole chain; one SELECT over the project graph, naming the project's `projectId`; quote the query it echoes |
| The backlog in order | `get_backlog` | the tree with rollups, and the only read in rank order |

Read the glossary before the first of them, and say which tool answered. A question about what a
project holds, what relates to an item or what is in its way goes to `fuseki-search`, which picks
among these in order of cost.

## Links: typing what the embedder drew

The embedder links items that read alike with the placeholder word `related`. Those are the
untyped links. `list_untyped_links` pages a project's untyped links — with `changeSetId`, only those
touching what that run wrote — each with both ends' codes, titles and matching passages, and once per
page the words they may be typed with, each with its meaning.

`type_link` gives one link its word and direction, inside the run's change set (`changeSetId` is
required). The typing itself is `fuseki-linker`'s: it pages the queue, chooses each word by its
meaning, reports the possible duplicates and hands back one line per link. Choose the word from the
ones the page offered; send `newWord` only when none of them says it. A link flagged as a possible duplicate is refused: report it to the person, never type it.
A typed link keeps its inferred origin and waits for a person.

**No tool confirms or rejects a link**, and that is the rule, not a gap: a verdict is a person's
judgement, given on the links screen. Send the person there to rule.

## Writing a work item well

`create_work_item` writes a filled, labelled item in one call — only `title` is required, and a kind
left unnamed takes the organisation's default. `create_work_items` is the epic split: many at once,
each able to name its parent by reference code, including the code of another item in the same call.

`update_work_item` is partial **here**: whatever you send changes and the rest stays. That is this
tool merging on your behalf, not the API beneath it, which replaces everything — so the merge only
works if you send the version you read.

`set_work_item_labels` **replaces the whole set**. "Add a label" is the call people expect and is
not what this is; read the item's labels first and send them all back with the new one.

The fields, the exact words each enumerated value takes, and what delete and restore do are in
[reference/work-items.md](reference/work-items.md). Read it before your first write in a session; a
misspelt value is refused naming the argument, so it costs a round trip rather than a wrong row.
Kinds, levels, reparenting and the fractional rank are in
[reference/hierarchy-and-backlog.md](reference/hierarchy-and-backlog.md); the sprint state rules and
what carries over at a close are in
[reference/sprints-and-boards.md](reference/sprints-and-boards.md); the version rule and the shape
of a conflict are in
[reference/change-sets-and-versions.md](reference/change-sets-and-versions.md).

## Decisions that are not yours

Closing a sprint moves work somebody committed to. Deleting an item, reverting a run and archiving a
project take work away. Present what would happen — `preview_sprint_close` says exactly what a close
would carry over — and ask before doing any of them.
STOP and call the AskUserQuestion tool to clarify.

## Reading a refusal

A refused call names its code, what happened, the arguments at fault, and what to do next. Do what
the recovery says rather than resending.

- `INVALID_ARGUMENT` — fix the named arguments. Nothing was read or changed.
- `NOT_FOUND` — a name matched nothing in a list the server just read. The refusal lists what does
  exist. **It never means "you lack permission."**
- `CONFLICT` **naming a version** — the item moved under you. Decide again from the item the refusal
  carries, then write against the version it names.
- `CONFLICT` **naming no version** — either a rule of the project refuses the change, or nothing you
  can see answers to the name you gave. Fuseki deliberately gives one answer for both, so that being
  refused cannot be used to learn what exists. Read what is actually there and change what you asked
  for.
- `FORBIDDEN` — about who is asking. Either a ProjectManagement permission is missing, which the
  tool's description names, or the organisation is in read-only mode. Neither is fixed by retrying.
- `SERVER_MISCONFIGURED` or `UPSTREAM_UNAVAILABLE` — not about your call; follow the `fuseki`
  skill's troubleshooting.

`create_work_item` and `create_work_items` are several writes in one call and can be refused
part-way: the item exists with whatever was written before the refusal. The message says so; read it
back with `get_work_item` and finish with `update_work_item` or `set_work_item_labels` rather than
creating again.

## Rules that are easy to get wrong

- Never invent a project, a kind, a state or a label. Reads answer what exists.
- `get_work_item` answers deleted items too, carrying the date they were deleted — a successful read
  is not proof the item is live.
- No list returns a total. "You can see 2 of 5" would leak the other three by subtraction.
- Do not cache what a read answered across turns: another person in the same organisation may have
  written since, and a version in particular is stale the moment they do.
- One write per changed thing, each against the version the last one answered.
- A Kanban project has no sprints at all, and every sprint tool refuses it rather than answering an
  empty list.
