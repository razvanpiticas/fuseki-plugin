---
name: fuseki
description: The front door to Fuseki and the connection under every other Fuseki skill. Invoked with nothing, it signs in, binds this repository to a Fuseki project in a gitignored .fuseki/state.json, checks git, GitHub and browser testing on this machine, shows where the project stands and offers everything the plugin can do. Set up GitHub or set up browser testing again through it. Use when the person types the Fuseki command alone, asks what Fuseki can do or where the project stands, wants this repository bound to a project, when sign-in or a connection is failing, when a Fuseki tool refuses a call and the refusal needs reading, or when somebody asks what access they have. For reading or writing a project's work, load the fuseki-work skill, which this one hands off to.
---

# Fuseki

Fuseki's MCP server fronts the product's ProjectManagement service. It holds no database of its
own: every tool call is an HTTP call to a service that already enforces the product's own rules,
made **as the person using GPT** rather than as a service account.

That is the fact everything else follows from. The server never sees more than the caller does, so
a tool that refuses is usually reporting the caller's own access rather than a fault.

**A task typed after the command is routed before anything else is done**, as
[The front door](#the-front-door) says: it goes to the skill that does it, and the status and the
menu are skipped.

## The front door

`$fuseki` with nothing after it is the way in for somebody who does not know what to ask,
and the first run of it in a repository sets that repository up. Named with a task instead — after
the command, or as the answer to the menu — the task skips steps 8 and 9 and goes to its skill once
steps 1 to 4 have run: reading or writing a project's work goes to `fuseki-work`, finding what a
project holds or what relates to an item goes to `fuseki-search`, typing the links goes to
`fuseki-linker`, distilling the insights goes to `fuseki-distiller`, switching a routine on or off or
running one — "run the Weekly distiller now" included — goes to `fuseki-routines`, planning the product vision, an epic, a feature or a story
goes to `fuseki-plan-product-vision`, `fuseki-plan-epic`, `fuseki-plan-feature` or `fuseki-plan-story`,
mapping the code or writing one of its wiki documents goes to the `fuseki-map-` skill of that
document, writing the coding standards goes to `fuseki-coding-standards`, and a line of the menu goes
to the skill it names.

Every step that touches this repository runs the plugin's command-line tool from the repository's
root, which is the directory this session was started in:

```bash
pnpm dlx github:razvanpiticas/fuseki-plugin <command>
```

It prints what it did. A command that exits non-zero stops the front door: quote its message and
stop. **Never delete, replace or hand-edit `.fuseki/state.json`** — a file the tool cannot read is
the person's to fix, and the message says what is wrong. Nothing but the tool writes it, and each
skill writes only its own key ([reference/front-door.md](reference/front-door.md) has the table).

Nine steps, in this order:

1. **Sign in.** Call `list_portfolios`. A 401 means sign in again, as [Connecting](#connecting) says;
   any other refusal — `server_info` first, then [Reading a refusal](#reading-a-refusal). Nothing
   else is called until this answers.
2. **The state.** Run `pnpm dlx github:razvanpiticas/fuseki-plugin state init`, then `pnpm dlx github:razvanpiticas/fuseki-plugin state reconcile`. The first creates `.fuseki/state.json`
   from the template and adds `.fuseki/` to `.gitignore` when they are missing, fills the keys an
   older file lacks, and stops when git would not ignore `.fuseki/.env`. The second clears every
   recorded path whose file is gone. Say in one line what either changed; say nothing when neither did.
3. **The project.** Run `pnpm dlx github:razvanpiticas/fuseki-plugin state get project`.
   - A key is recorded: `get_project` with it. It answers and is not archived: that is the project.
     Say which, in one line. A refusal or an archived project is said, and the person picks again.
   - No key, or picking again: call `list_projects`, list the projects that are not archived by name
     and key, and ask which one this repository is bound to. STOP and use Codex's structured user-input tool when available; if it is unavailable, ask directly in chat to clarify. Never pick for the
     person, even when there is one. Then record it, with its portfolio's key from what
     `list_portfolios` answered (empty when it has none):
     `pnpm dlx github:razvanpiticas/fuseki-plugin state set project '{"key":"<key>","name":"<name>","portfolioKey":"<portfolio key>"}'`.
   - Run `pnpm dlx github:razvanpiticas/fuseki-plugin state get docsRoot`. Empty: when a `.docs` directory exists at the root, record it with
     `pnpm dlx github:razvanpiticas/fuseki-plugin state set docsRoot '".docs"'`; otherwise ask where this repository keeps its documentation and
     record the directory the person names. Create it first when it does not exist (`mkdir -p
     <directory>`): `state reconcile` clears a recorded path that is not on disk, so a directory
     recorded before it exists is asked for again on the next run.
4. **The documents.** Run `pnpm dlx github:razvanpiticas/fuseki-plugin state discover`. It records, under keys that are still
   empty, the documents already where the skills write them — the product vision, the coding
   standards, the system-wide architecture, structure and testing, and each subsystem's documents
   and decision records — and prints a `Recorded …` line for each: say them in one line, and nothing
   when there are none. It never replaces a recorded path.
   - **Candidates.** A `Candidate for <key>: <path>` line is a document whose place is not certain.
     When there are any: STOP and use Codex's structured user-input tool when available; if it is unavailable, ask directly in chat to clarify. Ask once, listing every candidate with its key, which to
     record; for a candidate offered for a whole subsystem (`wiki.subsystems.<name>`), also which of
     its lists it belongs in: `systems`, `crossCutting`, `guides`, `patterns`, `walkthroughs` or
     `decisions`. Record each one picked by setting its list with the path added and every path
     already in it kept: `pnpm dlx github:razvanpiticas/fuseki-plugin state set <key> '["…", "<path>"]'`, or the subsystem's whole
     entry when it has none, `root` its folder and every other value empty but this path. Set
     `discovery.ignored` once with every candidate not picked added and every path already in it
     kept, so none is asked about again.
   - **The vision on the server.** When `productVision.path` is set, `productVision.savedToServerAtUtc`
     is empty and the path is not in `discovery.ignored`, call `get_product_vision` with the project's
     key. When the project has no vision: STOP and use Codex's structured user-input tool when available; if it is unavailable, ask directly in chat to clarify. The question, word for word: "This
     repository has a product vision at <path>, and the project in Fuseki has none. Save it to the
     project?" **Yes:** read the file, `start_change_set` with the project's key and the summary "Save
     the product vision of <key> from <path>", `save_product_vision` with the file's whole text,
     unchanged, and the change set's id, `complete_change_set` with outcome `Completed`, then
     `pnpm dlx github:razvanpiticas/fuseki-plugin state set productVision.savedToServerAtUtc '"<date -u +%Y-%m-%dT%H:%M:%SZ>"'`. A
     refusal saved nothing: complete the change set `Failed` with its sentence, say it in one line,
     and go on with step 5. **No:**
     add the path to `discovery.ignored`, so the question is not asked again.
5. **Repository and GitHub.** Run `pnpm dlx github:razvanpiticas/fuseki-plugin tooling check`; it covers this step and the next. Read
   `pnpm dlx github:razvanpiticas/fuseki-plugin state get repository`, then:
   - No git (`hasGit` false): say so in one line. Nothing that needs git is offered — the
     continuous-integration checks and the commit-based steps of the plan skills.
   - `gh` missing (`github.ghCli.available` false) and not `declined`: STOP and use Codex's structured user-input tool when available; if it is unavailable, ask directly in chat to clarify. The
     question, word for word: "Planning a story can check that continuous integration passes, which
     needs the GitHub command-line tool. Install it now?" **Yes:** guide the person through
     [reference/github-cli.md](reference/github-cli.md), then run `pnpm dlx github:razvanpiticas/fuseki-plugin tooling check` again. **No:**
     `pnpm dlx github:razvanpiticas/fuseki-plugin state set repository.github.ghCli.declined true`.
   - `gh` present and not signed in (`authenticated` false): tell the person to type `! gh auth login`
     themselves — it is interactive, and this skill never runs it — then run `pnpm dlx github:razvanpiticas/fuseki-plugin tooling check` again.
   - Say which continuous-integration provider was found, and its workflow files.
6. **Browser testing: `playwright-cli`.** Read `pnpm dlx github:razvanpiticas/fuseki-plugin state get uiTesting`.
   - `playwrightCli.available`: say its version, then go on.
   - Missing and not `declined`: STOP and use Codex's structured user-input tool when available; if it is unavailable, ask directly in chat to clarify. The question, word for word: "Planning a feature
     or a story writes browser checks run with playwright-cli. Install it now?" **Yes:** guide the person through
     [reference/ui-testing.md](reference/ui-testing.md), then run `pnpm dlx github:razvanpiticas/fuseki-plugin tooling check` again. **No:**
     `pnpm dlx github:razvanpiticas/fuseki-plugin state set uiTesting.playwrightCli.declined true`, and say the plan skills will write the browser
     checks without running them.
7. **Browser testing: the app's address and sign-in.** Only when `playwrightCli.available` is true and
   `requiresSignIn` is `null`:
   1. Ask for the app's local address, and record it: `pnpm dlx github:razvanpiticas/fuseki-plugin state set uiTesting.baseUrl '"<address>"'`.
   2. STOP and use Codex's structured user-input tool when available; if it is unavailable, ask directly in chat to clarify. The question, word for word: "Does the app need a sign-in to use it?"
   3. **No:** `pnpm dlx github:razvanpiticas/fuseki-plugin state set uiTesting.requiresSignIn false`.
   4. **Yes:** run `pnpm dlx github:razvanpiticas/fuseki-plugin env init`, then tell the person to open `.fuseki/.env` themselves and fill in
      `FUSEKI_UI_USERNAME` and `FUSEKI_UI_PASSWORD` for a test account. When they say it is done, run
      `pnpm dlx github:razvanpiticas/fuseki-plugin env check` and say which keys are present.

   **Never ask for, read aloud, echo or write a credential.** Not in the chat, not in a command, not
   in the state. `.fuseki/.env` is never opened by this skill: `pnpm dlx github:razvanpiticas/fuseki-plugin env check` reports the names of the
   keys that are filled, and that is all anybody here needs to know. When `requiresSignIn` is already
   `true`, run `pnpm dlx github:razvanpiticas/fuseki-plugin env check` on every run, so the browser-testing line says what the file holds now.
8. **Status.** Eight lines, each read, never invented — the fields are in
   [reference/front-door.md](reference/front-door.md): the project; the open sprint; the untyped
   links; the pending proposals; the routines switched on; the documents; the repository; browser
   testing.
9. **The menu.** The fenced block in [reference/front-door.md](reference/front-door.md), printed
   as it stands inside a code block — every line, its numbers, its group headings and its "not in
   this version yet" — never rewritten as a list. Then do what the person picks. A line marked "not in this version yet" answers one sentence and shows the
   menu again.

The front door writes nothing on the server but a product vision the person agreed to save in step
4. On this machine it writes only through the tool, and a second run on a repository nothing changed
in asks nothing and changes nothing. **Set up GitHub**
reruns step 5, and **set up browser testing** reruns steps 6 and 7, even when the person declined or
answered before: `declined` is set back to `false` and `requiresSignIn` to `null` with `pnpm dlx github:razvanpiticas/fuseki-plugin state set`
before the step runs again.

## Connecting

The server ships with this plugin. Enabling the plugin registers it — there is nothing to add by
hand. If tool calls answer 401, run `codex mcp login fuseki` to sign in again.

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

Sixty-seven, in families. `list_`, `get_` and `run_` read; `create_`, `add_`, `record_` and `observe_`
create; `update_` and `save_` edit; `transition_`, `type_`, `change_`, `move_`, `set_`, `start_`,
`close_`, `restore_`, `supersede_` and `contradict_` change state; `delete_`, `remove_` and `revert_` take
something away.

| Family | Tools |
| --- | --- |
| This deployment | `server_info` |
| Projects and portfolios | `list_projects`, `get_project`, `get_project_vocabulary`, `list_portfolios`, `get_portfolio`, `list_teams`, `get_product_vision`, `create_project`, `update_project`, `archive_project`, `add_project_member`, `remove_project_member`, `save_product_vision` |
| Work items | `get_work_item`, `list_work_items`, `search_work_items`, `lookup_work_items`, `create_work_item`, `create_work_items`, `update_work_item`, `transition_work_item`, `change_work_item_type`, `change_work_item_parent`, `move_work_item`, `rebalance_backlog`, `set_work_item_labels`, `delete_work_item`, `restore_work_item` |
| Backlog, sprints and boards | `get_backlog`, `list_sprints`, `get_sprint`, `preview_sprint_close`, `list_boards`, `get_board`, `create_sprint`, `update_sprint`, `start_sprint`, `close_sprint`, `add_to_sprint`, `remove_from_sprint` |
| Conversation and links | `list_comments`, `add_comment`, `list_work_item_links`, `link_work_items`, `unlink_work_items`, `list_untyped_links`, `type_link` |
| Finding related work | `get_similar_work_items`, `get_neighbours`, `get_dependencies`, `run_analytical_query` |
| Runs and taking them back | `list_change_sets`, `get_change_set`, `start_change_set`, `observe_change_set`, `complete_change_set`, `revert_change_set` |
| Routines | `list_routines`, `get_routine` |
| Skill definitions and what was learned | `list_skill_definitions`, `get_skill_definition`, `list_insights`, `get_insight`, `record_skill_definition_insight`, `supersede_insight`, `contradict_insight` |

**There is no tool named after a kind of work item.** Fuseki has no Epic, Feature, Story or Task
entity — a work item's kind is a row an organisation edits — so the call is
`create_work_item` with the kind named as an argument, and `get_project_vocabulary` answers which
kinds this organisation actually has.

The server also publishes one resource, `fuseki://glossary`: the product's words, one meaning each.
It is a resource, not a tool. Read it once before searching or typing links, and ask in its words;
the `fuseki-work` skill says how this harness reads it.

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
STOP and use Codex's structured user-input tool when available; if it is unavailable, ask directly in chat to clarify.

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
