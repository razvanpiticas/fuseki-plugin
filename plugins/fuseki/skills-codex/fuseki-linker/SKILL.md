---
name: fuseki-linker
description: Type the links in Fuseki — gives every untyped link the embedder drew between work items that read alike its meaning, the word that fits (blocks, duplicates, causes, relates to or the organisation's own), its direction and, for a word with a size, how much. Use it before completing a change set that wrote work items, when the Weekly linker routine fires, and whenever a person says "type the links", asks what the related links mean, or wants the project's inferred links given words. Handed a change set, it works inside it and never completes it. It reports possible duplicates instead of typing them, and it never confirms or rejects a link and never merges two items: those are a person's, on the links screen.
---

# Fuseki linker

The server embeds every work item and draws a link with the placeholder word `related` between two
items that read alike. That link is a distance, not a meaning: it says the two items are near, not
that one blocks the other. Giving it a word needs a language model, and the server runs none. So the
word is yours to give, through this skill and nothing else in the plugin.

Every call is made as the signed-in person; the connection is the `fuseki` skill's job. Every
`type_link` carries a `changeSetId`, so the project's history says which run gave the link its word
and the run can be taken back whole.

## Three triggers, one loop

| Trigger | Who invokes you | The change set | What you list | What you hand back |
| --- | --- | --- | --- | --- |
| A change set that wrote work items is about to complete | the skill that opened it, before its `complete_change_set` | the caller's: you open none and complete none | `list_untyped_links(projectKey, changeSetId)` — only the links touching items that run wrote | one line per link, for that skill's report |
| The Weekly linker routine fired | `fuseki-routines`, inside the change set it opened naming the routine | the routine's: you open none and complete none | `list_untyped_links(projectKey)` — the whole project's queue, page by page | the digest, which `fuseki-routines` completes the change set with |
| A person asks: "type the links on FUS" | the person | yours: `start_change_set(projectKey, summary)` first, `complete_change_set` last | `list_untyped_links(projectKey)` — the whole project's queue | the digest, as the change set's summary and as your answer |

**Handed a change set id, you never complete it.** Not when it names the Weekly linker, not when the
routine's instructions say "report … in the digest", not when no `fuseki-routines` is loaded and
nobody says who will close it, not when your work is done. The change set is the caller's: the
skill that opened it, or `fuseki-routines`, which fired the routine, completes it with your lines or
your digest. Completing it yourself ends the caller's run under it: whatever the caller writes next
is refused. So your last call is the last `type_link` or `observe_change_set`; the digest is your
answer, and the change set stays `Running`. That is the correct end, and your answer says so in one
line: "Change set <id> is still running; its caller completes it with this digest." A routine's
"no change set scope" means the list is the whole project's, not that the change set is yours.

Handed none, you are the third row: open one with a one-line summary ("Type the links on FUS"), no
`routineId` (a person asking is not a routine), and complete it at the end with outcome `Completed`
and the digest as its summary. That change set, the one `start_change_set` answered you, is the only
one you ever complete. The project is the one named, else the one this repository is bound to
(`pnpm dlx github:razvanpiticas/fuseki-plugin state get project`).

## The loop

1. **List.** `list_untyped_links` with `changeSetId` when the caller's run is the scope, without it
   for the whole project. Each link has its `linkId`, its `confidence` (how alike the two read, 0 to
   1), `isPossibleDuplicate`, and both ends, `from` and `to`, each with `referenceCode`, `title`,
   `itemTypeName` and the `passage` of that item nearest the other (null when the item has no text
   beyond its title). Every page also carries `words`: each word you may type with, shipped and this
   organisation's own, with its `name`, `inverseName`, `description` and `isSymmetric`. Read the
   descriptions once per session before choosing.
2. **Leave a possible duplicate alone.** `isPossibleDuplicate` true means the two items may be one
   piece of work written twice. Do not type it, do not merge anything, do not delete either item: put
   the pair in the report. A person decides that on the links screen.
3. **Read the two passages.** Most links are settled by them: they are what the embedder matched
   on. Say what one item does to the other in one sentence with both titles in it.
4. **Read whole when the passages are not enough** — a passage is null, or the sentence will not
   come: `get_work_item` on each end's `referenceCode`.
5. **Choose the word** by the test in [reference/choosing.md](reference/choosing.md): the narrowest
   word whose description, read whole, is your sentence. An existing word beats a new one. A new word
   only when none on the page fits, sent with `newWord`.
6. **Direction.** The word reads from a first item to a second ("the first blocks the second"). When
   the listed `from` is your first item, send `FromTo`; when the listed `to` is, send `ToFrom`. A word
   whose `isSymmetric` is true takes `FromTo` always.
7. **Magnitude** only on a word whose description says it carries a size, and only when the text
   states the size: `magnitude` and `unit` together, or neither.
8. **`type_link`** with `linkId`, `word`, `direction`, `magnitude?`, `unit?`, `newWord?` and
   `changeSetId`. The answer is the link with state `Typed`; its origin stays `Inferred`, which keeps
   the embedder's guesses scorable, and it waits for a person's verdict.
9. **One line per link** in the format of [reference/report.md](reference/report.md): the codes, the
   arrow as typed, the word, the confidence, then your sentence —
   `FUS-9 → FUS-12: blocks (0.88) — the invoice cannot be marked paid until the payment webhook exists`.
10. **Next page** with the `nextCursor` the answer gave, until it is null. Over the whole project,
    after each page, `observe_change_set` with one line: how many read, typed, left alone and why.

Then hand back, as the trigger table says: in session the lines; otherwise the digest of
[reference/report.md](reference/report.md). Handed a change set, that is the end: no
`complete_change_set`. Your own change set, `complete_change_set` with the digest, then the answer.

## What you never do

- Complete, cancel or fail a change set you were handed. `complete_change_set` is for the change set
  you opened yourself, on a person's request, and no other; a handed one is left `Running` for its
  caller, even when nobody else is in the session.
- Confirm or reject a link. No tool does either: a verdict is a person's, on the links screen.
  Typing is a proposal of meaning; when the person asks you to confirm, say where they do it.
- Merge, delete or edit two items a duplicate flag names. Report the pair.
- Type a link with the word `related`: that is the placeholder being replaced.
- Invent a word when one on the page fits, or a new word under a name the page already offers.
- Try words until one goes through. A refusal saying a person rejected this pair under that word is
  their verdict on that guess: type it with another word only when that word fits on its own merits;
  otherwise leave the link untyped and report it.
- Wait for the embedder. A short or empty list before a change set completes is normal: the last
  writes may not be embedded yet, and the Weekly linker catches them.
- Ask. Nobody is asked per link. Unattended nobody is there to answer; in session the calling skill
  reports your lines and the person reads them.

## Reading a refusal

- `NOT_FOUND` naming `word` — no word of that name exists. Choose one from the page, or send it again
  with `newWord` when it is a word worth adding.
- `INVALID_ARGUMENT` naming `word` — you sent `related`, the placeholder; send the word that says how
  they relate, or leave the link untyped. Naming `newWord` — you sent a new word under a name the page
  offers; send the name alone. Naming `direction` — the word "reads the same from both ends"; send
  `FromTo`. Naming `magnitude` or `unit` — send both or neither.
- `CONFLICT` "flagged as a possible duplicate" — you missed the flag; leave it and report it.
- `CONFLICT` "was already confirmed" or "rejected" — a person ruled on it; leave it.
- `CONFLICT` "This pair was rejected for this word; pick another or leave it." — the rule above:
  another word only on its own merits, else untyped and reported.
- `CONFLICT` "read out of an item's own text" or "a link somebody drew" — not yours to type; report it
  as a fault in the list.
- `CONFLICT` naming the change set — it was completed or cancelled. Nothing was written. Stop and hand
  back: the caller opens a new change set before anything else.
- `FORBIDDEN` — the person's role cannot write; say so and stop.

## Rules that are easy to get wrong

- The word's meaning is on the page, in `words`. Nothing in this skill lists the words, because an
  organisation adds its own.
- `ToFrom` is relative to the pair **as listed**, not to the order you read the ends in.
- Report what `type_link` answered, by code — `FUS-9 → FUS-12: blocks` — never what you meant to
  send.
- A new word is created for the whole organisation the moment you type with it, without approval.
  That is allowed; it is also why its description has to be good enough for the next agent, and why
  reuse comes first.
- The whole-project list holds links between items nobody in this session touched. That is the
  point: text a person typed on the screens, where no model was present, gets its meaning here.
