# The hierarchy, the backlog, and splitting an epic

Fuseki has one work-item table and one tree. What kind of thing an item is, and what may hang from
what, are both rows an organisation edits — so everything here is read before it is written.

## Kinds and levels

`get_project_vocabulary` answers every kind the organisation offers, each with a `hierarchyLevel`.
A typical delivery chain looks like this, though yours may not:

| Kind | Level |
| --- | --- |
| Epic | 1 |
| Feature | 2 |
| Story | 3 |
| Bug | 3 |
| Task | 4 |

**A parent's level must be exactly one less than its child's.** Not "at least one" — exactly one.
So a Story hangs from a Feature and never straight from an Epic, and a Bug at level 3 can hold Tasks
at 4 and can itself hang from a Feature. Two kinds at the same level are siblings, never parent and
child.

Discovery kinds — Opportunity, Idea, Bet, Insight in a stock organisation — sit in a band far above
the delivery levels, deliberately, so that the exactly-one rule can never make one of them a legal
parent of delivery work.

Two tools meet this rule from opposite ends. `change_work_item_type` can orphan a subtree: moving a
Feature down to a Story leaves its Stories at the same level as their parent. `change_work_item_parent`
is refused when the two levels do not differ by one. Both refusals name the level a workable parent
would sit at, but the arithmetic is yours to do first.

## Reading a backlog

`get_backlog` is the only read in rank order. It answers the tree — roots, their children, and any
item with no parent — each node carrying its work item, its category, its level, its labels, its
custom field values, a rollup of what sits beneath it, and its own version.

`expansionDepth` bounds how deep it goes. It defaults to 4 and is **refused** outside 1 to 10 rather
than quietly clamped, so ask for what you need.

`list_work_items` is the flat, filtered, paged read and **cannot be ordered by rank** — its sorts
are `Newest`, `RecentlyUpdated` and `ReferenceCode`. If the order matters, the backlog is the read.

## Ranking

`move_work_item` places an item **relative to a named sibling**: above one, or below one, by
reference code. There is no index, no position number and no rank string you can send.

```json
{ "referenceCode": "FUS-144", "aboveReferenceCode": "FUS-142", "expectedVersion": 8 }
```

The rank is fractional underneath, which is why this is cheap: putting one item between two others
moves that item and nothing else. Neighbours keep the ranks they had, so a long backlog does not
renumber and nobody else's read goes stale because you reordered two things.

Give one neighbour or the other, not both.

**A newly created item has no position at all**, and a move made relative to one is refused —
which catches every run that writes a backlog and then tries to order it. `rebalance_backlog`
gives every item in the project a position, in the order the backlog already reads in, and changes
nothing else:

```json
{ "projectKey": "FUS", "changeSetId": "..." }
```

Call it once after creating the items and before the first `move_work_item`. It answers a count,
not the items, because nothing about the backlog looks different afterwards — and the count is
every item the project holds, deleted and archived ones included, so expect it to exceed the
backlog you just read.

## Splitting an epic

`create_work_items` is the call for it. One request, many items, each able to name its parent by
reference code — including the code of an item created earlier in the same call, so a whole subtree
lands in one go.

```json
{
  "projectKey": "FUS",
  "changeSetId": "0f8f7b1a-6c2e-4a3d-9c14-2b7e5d6a8f30",
  "items": [
    { "itemTypeName": "Feature", "title": "Organisation switcher", "parentReferenceCode": "FUS-12" },
    { "itemTypeName": "Feature", "title": "Remember the last organisation", "parentReferenceCode": "FUS-12" },
    { "itemTypeName": "Feature", "title": "Invite flow lands in the right organisation", "parentReferenceCode": "FUS-12" }
  ]
}
```

It answers every reference code it created, in order. Rank them afterwards with `rebalance_backlog`
and then `move_work_item` if
the order you proposed matters — creation order is not rank.

**Open a change set first.** Three creates and three ranks is six writes; without one they are six
separate sessions and taking them back means six separate undos, none of which exist. With one, the
whole split is one `revert_change_set`.

**A part of this call can be refused while earlier parts stand.** The items exist with whatever was
written before the refusal; read them back with `get_work_item` and finish with `update_work_item`
or `change_work_item_parent` rather than creating the batch again.

## The item type is not the workflow

Changing an item's kind does not change what state it is in, and the new kind may use a different
workflow with different states. Read `get_project_vocabulary` after a kind change if you then need
to move the item, because the state names that were valid a moment ago may not be.
