# Versions and change sets: the two things that make an agent run safe

An agent writes forty items in ninety seconds, may retry, may partially fail, and may be wrong.
These two mechanisms are what make that survivable. Neither is optional in practice and neither
costs anything to use.

## The version

Every work item carries a row version. `get_work_item` answers it; five tools take it and answer the
one they produced.

| Takes `expectedVersion` | Does not |
| --- | --- |
| `update_work_item` | `set_work_item_labels` |
| `transition_work_item` | `delete_work_item` |
| `change_work_item_type` | `restore_work_item` |
| `change_work_item_parent` | `add_comment` |
| `move_work_item` | everything else |

The second column is not an oversight to work around: those routes read no precondition, so asking
for a version there would promise a protection that does not exist.

Carry the version forward. A write answers the version it produced; the next write on the same item
sends that one. Two writes against the same version means the second is refused — which is the
system protecting a decision you made on state that has since moved, not a fault.

## What a conflict looks like

A refusal that names a version carries **the item as it now stands** and **the version that won**:

```
CONFLICT

Somebody else changed this item between the read this call was written against and the write, so
nothing was saved. It is now at version 14. The item as it now stands is below — read it, decide
what you meant given what is actually there, and write again.

{ "referenceCode": "FUS-142", "title": "…", "workflowStateId": "…", … }

expectedVersion: Stale. Send the version this refusal names.
```

You need no further read. The recovery is: look at what the item actually says now, decide whether
the change you were making still makes sense, and if it does, send it against version 14.

**Do not simply resend.** Your change was decided against an item that no longer exists in that
state. Somebody may have already done what you were about to do, or done something that makes it
wrong. Resending is how two people's work becomes one person's work.

## A conflict that names no version

That is a different thing wearing the same code. It means either that a rule of the project refuses
what you asked — a parent at the wrong level, a sprint that is closed, a change set already
completed — or that nothing you can see answers to the name you gave.

Fuseki gives one answer for "no such project" and "not your project" **deliberately**: telling them
apart would let anybody map an organisation by being refused. So there is nothing to distinguish and
nothing to retry. Read what is actually there, and change what you asked for.

## Change sets

```
start_change_set   →  answers an id
   ↓  pass it as changeSetId on every write in the run
complete_change_set
   ↓  and if the run was wrong
revert_change_set  →  everything it created is gone, everything it changed is back
```

Open one whenever a run will write more than once. Without one, every write opens and closes a
session of its own, and taking back a forty-item decomposition means forty separate undos that do
not exist as a single act.

`revert_change_set` is **refused while the run is still open**. Complete first — undoing an open run
would leave behind whatever it writes next. Completing twice is also refused, because a second
completion means something else believes it owns the same session.

A revert answers two lists: what it took back (items the run created, now deleted) and what it put
back (items the run changed, now restored to what they were). Reverting twice is refused.

## Retrying a call that timed out

Safe. Every write this server makes carries a key derived from who is calling, what they are doing,
with what body, in which change set — so a call that timed out and is sent again is recognised as
the same call and answered with what the first attempt produced, rather than writing twice.

You do not send that key and there is no argument for it. The one consequence worth knowing: **two
deliberately identical writes inside one change set** — the same title, the same kind, the same
parent — are treated as one. The tool answers the same reference code both times, which is visible.
If you genuinely want two, make them different, or make them in different runs.

## What a refusal changed

Nothing, unless it says otherwise. The one exception is a composed create — `create_work_item` and
`create_work_items` are several writes in one call, and a refusal part-way leaves the earlier parts
written. Those refusals say so; read the item back and finish it rather than creating again.
