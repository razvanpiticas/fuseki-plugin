---
name: fuseki-search
description: Search the work in Fuseki — load this before answering any question about what a Fuseki project holds, such as "what does FUS-5 say", "what tickets relate to FUS-12", "what blocks what blocks FUS-12", "why can FUS-40 not start", "is there already an item about this", or "what do we have on invoicing". It picks the cheapest instrument that answers — an exact read by reference code, the items nearest one item in meaning, a search by meaning, the blocking chain, or one shaped query over the project graph for a question of more than one hop — runs it, and names it in the answer. Load it even when the person never says search, and before calling any of its instruments yourself to answer a question — get_work_item, lookup_work_items, get_similar_work_items, list_work_item_links, get_neighbours, search_work_items, get_dependencies or run_analytical_query. Reads only; it writes nothing.
argument-hint: <project key or reference code> <the question>
allowed-tools: ReadMcpResourceTool, ListMcpResourcesTool, Bash(node "${CLAUDE_PLUGIN_ROOT}/cli/bin/fuseki.mjs" *), mcp__fuseki__get_work_item, mcp__fuseki__lookup_work_items, mcp__fuseki__search_work_items, mcp__fuseki__get_similar_work_items, mcp__fuseki__list_work_item_links, mcp__fuseki__get_neighbours, mcp__fuseki__get_dependencies, mcp__fuseki__run_analytical_query, mcp__fuseki__get_project, mcp__fuseki__get_project_vocabulary, mcp__fuseki__list_projects, mcp__fuseki__list_portfolios
---

# Fuseki search

Writing work is `fuseki-work`'s. This skill is for finding: the reads where nobody holds the code,
or somebody holds one and wants what is related to it, tied to it or in its way. It picks the instrument, runs it, and answers with the items found, by reference code, and the
call or query it ran, so the person and the calling skill can see what was asked. It writes nothing:
no change set, no link, no comment.

The instruments do not cost the same. An exact read and the items nearest one item are free: the
second compares vectors the server already holds. A search by meaning embeds the question and spends
the organisation's embedding allowance. A shaped query is a database query with a five-second limit.
That is why the rule below is applied in this order.

## The steps

Every question goes through these four steps in this order.

1. **Read the glossary, once per session, before any instrument.** Fuseki's words — work item,
   reference code, link, link word, untyped link, possible duplicate, passage, search by meaning,
   similar items, neighbours, dependency chain, analytical query and the rest — are the resource
   `fuseki://glossary` on the server. Read it before the first call of any instrument, so the
   question is asked in the product's words and the answer read in them. Already read in this
   session: go to step 2. A harness that lists no resources skips it: the tool descriptions carry
   the words the instruments need.
   Here, `ReadMcpResourceTool` reads it with the Fuseki server's name and uri `fuseki://glossary`.
   The server is `plugin:fuseki:fuseki` when it came with this plugin, and `fuseki` when it was added
   by hand; `ListMcpResourcesTool` shows which. That call is this step.
2. **Choose the instrument** by [the rule](#the-rule): the first row that fits.
3. **Run it**, as its own section below says. A walk is at most three calls.
4. **Answer** in [the answer's shape](#the-answer): the instrument, the call as sent, the items by
   code, and the passage that matched when the instrument answered one.

## The rule

Apply in this order; the first row that fits is the instrument.

| The question | Instrument | Call | Cost |
| --- | --- | --- | --- |
| names a reference code and asks what the item says; or names part of a code or a title in one project | **exact** | `get_work_item(referenceCode)`; a fragment of a code or title: `lookup_work_items(projectKey, query)` | free |
| names one item and asks what relates to it, what it is tied to, what is near it | **related to one item** | `get_similar_work_items(referenceCode)` first; then `list_work_item_links(referenceCode)` for what it is joined to, `get_neighbours(referenceCode, hops)` for further out | free |
| names a subject and no code — "what do we have on invoicing"; or is a duplicate check before a write — "is there already an item about CSV export" | **by meaning** | `search_work_items(query)`, the question written once as a sentence | one embedding |
| asks why an item cannot start, or what has to finish first, and names no shape | **blocked chain** | `get_dependencies(referenceCode)` | free |
| names a shape of more than one hop — "what blocks what blocks FUS-12", "which items block an item that blocks FUS-12", "which children of FUS-3 are blocked from another project" | **shaped** | `run_analytical_query(projectKey, query)` with a shape from [reference/shapes.md](reference/shapes.md) | a query, five seconds, 200 rows |

A question that names a shape is shaped even when the blocking chain would contain its answer: the
person asked for that shape, and the query the server echoes shows exactly what was asked. The chain
answers "everything in the way"; "what blocks what blocks" is the second hop alone.

Never by meaning when a code is in hand: `get_similar_work_items` answers "what reads like this
item" for nothing. Never more than one `search_work_items` per question: one sentence, not one call
per phrasing. A question with two halves — "what is tied to whatever we have on invoicing" — is by
meaning first, then related to one item from each hit, within the three calls.
[reference/instruments.md](reference/instruments.md) has the rule with examples.

**The project.** A reference code is a project's key, a dash and a number (`FUS-12`, `A14W0330-3`);
a key alone has no dash (`FUS`, `A14W0330`), and "on FUS" names the project to look in, never an
item to read. A reference code carries its project's key before the dash (`FUS-12` → `FUS`).
A question that names neither a project nor a code reads the bound one from this repository:
`node "${CLAUDE_PLUGIN_ROOT}/cli/bin/fuseki.mjs" state get project`. Nothing bound and nothing named: ask which project.
STOP and call the AskUserQuestion tool to clarify.

## Exact

`get_work_item` answers the item whole, with its kind, state, parent and version. `lookup_work_items`
is the type-ahead: up to ten thin matches on a code or title fragment inside one project, never by
meaning. A deleted item still answers `get_work_item`, carrying the date it was deleted: say so.
A reference code is read from the server, not searched for in this repository's files. The answer
opens `Exact — get_work_item("FUS-5"):`, then the item's title, kind, state and description.

## Related to one item

`get_similar_work_items(referenceCode)` answers up to ten items nearest in meaning, each with its
similarity from 0 to 1, across every project the caller can see. It compares the item's own stored
vector with the others', so it spends nothing and answers while search by meaning is off. An item
saved seconds ago may not be embedded yet and answers an empty list: say that, not "nothing relates".

A similarity is a suggestion, not a link. For what the item is actually joined to,
`list_work_item_links(referenceCode)` answers its links one hop out, each worded from this item's
end, with the word, origin, verdict and confidence. `get_neighbours(referenceCode, hops)` walks up to
three links out in any direction; edges are written in each link's own direction, so match the ids
to the nodes before quoting one.

"What relates to FUS-12" is answered by the similar items first, then the links, in that order,
each under its own instrument line. The order is the answer's, not the calls': sent together or one
after the other, the "Similar items" section is written first and the "Links" section after it.

## By meaning

The glossary is read before this call (step 1). `search_work_items(query)` searches every item the
caller can see, by meaning and by word, and answers up to fifty hits. Each hit carries a score,
which half of the search found it, and `matchedPassage`: the stretch of text that matched, which is
a comment when the item was found through one. Write the question as one sentence about the subject:
"exporting invoices as a CSV file from the billing page". Quote the matched passage of every hit you
report that carries one. Many hits carry none (`matchedPassage` null, typically when the title alone
matched): write "no passage answered" for such a hit, and never put the item's description, or any
other text you read, under the words "matched passage" — the person reads that as what the search
found.

**Read `matchedPassage` on every hit you report before you write a word about its passage.** A
fifty-hit answer is often too long for the harness to show, and it is then kept in a file or cut
short: read each reported hit's `matchedPassage` from that file, by its reference code, and quote
it whole as the server answered it (it opens with the project, type, item and title lines). Whether
one hit carries a passage says nothing of the next: a schema or a sample printed beside a saved
answer shows the first hit's values, and the first hit's `null` is not every hit's. Never write "no
passage answered" for a hit whose `matchedPassage` you have not read and found `null`.

Here the harness saves an answer that is too long to a file and prints its path with a schema read
from the first hit (`matchedPassage: null` there means nothing for the rest). Pull the field with
the hits you will report, for example
`jq '.[] | {code: .workItem.referenceCode, title: .workItem.title, score, matchedPassage}' <file>`,
or the same fields from `ConvertFrom-Json` in PowerShell. A pull of code, title and score alone has
not read the passage.

For a duplicate check, the answer says yes or no, quotes the closest hit's passage and says which
words make it the same thing or a different one. The calling skill decides what to write.

## Blocked chain

`get_dependencies(referenceCode)` follows the blocking links outwards: `isBlocked`,
`reachedTheDepthCap`, and the steps, each naming the blocker, its hops from the subject and the item
it directly holds up. Read the steps as a chain. When `reachedTheDepthCap` is true the chain may go
on unseen: say so. Empty steps with `isBlocked` false means the item is ready.

## Shaped

A question with a shape is one `SELECT` you write over the property graph `fuseki_project_graph`,
run read-only inside the caller's organisation and visible projects, with a five-second limit and a
cap of 200 rows, the query echoed with the answer. Take the shape from
[reference/shapes.md](reference/shapes.md), fill its placeholders, and name the project on the
vertex you start from with the `projectId` that `get_project` answers. A word is matched by its
`linkTypeId`, which `list_work_item_links` answers on any link carrying it.

**A walk is at most three calls**, the reads that fill the placeholders included: for S1 that is
`get_project`, `list_work_item_links` and `run_analytical_query`, and the walk is spent. No fourth
call to check the shape's rows — not `get_dependencies`, not `get_neighbours`, not a second read of
the links: the rows the server answered are the answer, and a chain sent beside the shape is the
duplicate work the rule exists to prevent. A question needing more hops than a shape has runs a
shape again from the codes the first answered, within the three. When the shaped query is refused twice, answer by `get_dependencies` or `get_neighbours`
from the item named, say the shape did not run and quote what the server said. Never walk on call
after call until the question feels covered: the answer names the hops it reached.

## The answer

Always in this shape, whoever asked:

```
Similar items — get_similar_work_items("FUS-12"):
  FUS-31 Export the invoices as a CSV file from the billing page — 0.97
  FUS-44 Download a statement of account as CSV — 0.88
Links — list_work_item_links("FUS-12"):
  FUS-12 is blocked by FUS-9 Build the payment webhook endpoint (blocks, inferred, confirmed)
```

The instrument, the call as sent, then the items by code with their title and the number the
instrument gave, and the passage quoted where the instrument answered one (`search_work_items`'
`matchedPassage`, a link end's passage). An instrument that answers no passage, such as the similar
items, gets none: never write a passage it did not answer. For a shaped query, the query text
itself, whole, in a code block, exactly as the server echoed it, then one row per line. Naming the
shape ("the S1 shape with the blocks word") is not quoting the query: the person checks the query,
not its name, so the text is printed every time, the second question of a session included. Empty:
"nothing found", and which instrument said so.

## Reading a refusal

- `CONFLICT` of type `embedding-allowance-spent` on `search_work_items` — the organisation's
  allowance for this period is spent, or could not be read. Do not retry and do not rephrase. Answer
  by exact reads (`lookup_work_items` on the subject's words in the project) and by links
  (`get_similar_work_items`, `list_work_item_links` from what that found), and make the answer's
  first line: "Search by meaning is off for this organisation; answered by code and by links."
- `NOT_FOUND` or `CONFLICT` on a reference code — nothing the caller can see answers to it. Read the
  code again from a list rather than guessing another.
- `INVALID_ARGUMENT` on `run_analytical_query` — the guard: one `SELECT`, `FROM GRAPH_TABLE
  (fuseki_project_graph …)`, the project's id on the start vertex, no semicolon, under 4000
  characters. Fix what the message names and send it once more.
- `CONFLICT` on `run_analytical_query` naming a function, a table or "ran longer than" — narrow it:
  start from one item by its code, fewer hops, the project clause on the start vertex. Two refusals
  on one question: answer by `get_dependencies` or `get_neighbours` and say the shape did not run.
- `INVALID_ARGUMENT` on `get_neighbours` naming the cap — three hops is the most; walk again from a
  node of interest instead.
- `FORBIDDEN` — the person's role cannot read this; say so and stop.

## Rules that are easy to get wrong

- The glossary comes before the first instrument, once per session.
- A code in hand and a `search_work_items` sent is an embedding spent on what a free read answers.
- One search per question. Two phrasings are two embeddings for one answer.
- Name the instrument and the call in every answer, the empty ones and the exact reads included
  (`Exact — get_work_item("FUS-5")`). An answer that hides how it was found cannot be checked.
- A walk is three calls, and none of them a cross-check: a shaped query's rows are not verified by a
  `get_dependencies` beside it.
- A shaped answer prints the query text, not a description of it.
- A similarity says two items read alike, not that one needs the other. Say "reads like", never
  "depends on", unless a link with that word says so.
- In a run a routine fired, a spent allowance goes into the digest, not into a question: "search by
  meaning was off; answered by code and by links".
- This skill writes nothing. A duplicate it finds is reported to the person or the calling skill,
  which decides what to write.
