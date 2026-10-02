# The instruments, with examples

Load this when the rule in the skill leaves a doubt about which instrument a question wants, or
when writing the answer.

## Exact — the code is known, or part of it

| Asked | Do |
| --- | --- |
| "What does FUS-12 say?" | `get_work_item("FUS-12")` |
| "Which item was the CSV export on FUS?" | `lookup_work_items("FUS", "CSV export")` — a title fragment in one project |
| "Open FUS-4 and FUS-9" | two `get_work_item` calls, nothing else |

## Related to one item — the item is known, what is around it is wanted

| Asked | Do |
| --- | --- |
| "What tickets relate to FUS-12?" | `get_similar_work_items("FUS-12")`, then `list_work_item_links("FUS-12")` |
| "Is anything a duplicate of FUS-12?" | `get_similar_work_items("FUS-12")`; a similarity of 0.95 or more is what the embedder flags as a possible duplicate |
| "What is FUS-12 linked to?" | `list_work_item_links("FUS-12")` |
| "Everything within two links of FUS-12" | `get_neighbours("FUS-12", 2)` |

## By meaning — the subject is known, the item is not

| Asked | `search_work_items` query |
| --- | --- |
| "What do we have on invoicing?" | "invoicing: creating, sending and paying invoices" |
| "Is there already an item for exporting invoices as CSV?" | "exporting invoices as a CSV file" |
| "Anything about the payment webhook?" | "the payment webhook that receives payment events" |

One question, one sentence, the words the glossary uses. A duplicate check answers yes or no with
the closest hit's passage quoted: a hit whose passage says the same thing about the same subject is
a duplicate, one that only shares words is not, and the answer says which words decided it.

## Blocked chain — what has to finish first

| Asked | Do |
| --- | --- |
| "Why can FUS-40 not start?" | `get_dependencies("FUS-40")` |
| "Is FUS-40 ready?" | `get_dependencies("FUS-40")`: ready when `isBlocked` is false |

## Shaped — more than one hop, with a shape

| Asked | Do |
| --- | --- |
| "What blocks what blocks FUS-12?" | shape S1 of shapes.md |
| "What does FUS-9 hold up, and what do those hold up?" | shape S2 |
| "Which children of FUS-3 are blocked from another project?" | shape S3 |
| "What in the active sprint is blocked by unfinished work?" | shape S4 |

## Both halves

"What is tied to whatever we have on invoicing": one `search_work_items`, then
`list_work_item_links` on the strongest hits, within three calls, answered grouped by hit.

## The answer's shape

```
<Instrument> — <the call as sent>:
  <code> <title> — <the number the instrument gave> — "<passage, when the instrument answered one>"
  …
<for a shaped query: the query as the server echoed it, then one row per line>
<for links: one line per link, worded from the item asked about: word, origin, verdict, confidence>
nothing found — <instrument> answered no items
```

When search by meaning was off, the first line says so, and the rest is what the other instruments
found.
