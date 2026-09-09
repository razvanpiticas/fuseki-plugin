# Work items: every field, and the words each one takes

The schema of each tool is the authority on argument names. This file carries what a schema cannot:
which values an enumerated field actually accepts, what `update_work_item` does with what you leave
out, and the difference between deleting and archiving.

## The fields

| Field | Shape | Notes |
| --- | --- | --- |
| `title` | one line | the only field a create requires |
| `descriptionMarkdown` | markdown | what the work is |
| `acceptanceCriteriaMarkdown` | markdown | how anybody will know it is done |
| `technicalSolutionMarkdown` | markdown | how it is to be built |
| `priority` | `Highest` `High` `Medium` `Low` `Lowest` | a new item is `Medium` unless the create says otherwise |
| `severity` | `Critical` `Major` `Minor` `Trivial` | how badly something is broken, not how urgent it is |
| `estimate` | whole number | in the project's own scale — read `get_project` for which |
| `businessValue` | whole number | same scale caveat |
| `startDate`, `dueDate` | `YYYY-MM-DD` | dates only, no times |
| `assigneeAccountId` | account | one of the project's members, from `get_project_vocabulary` |
| `teamId` | identifier | one of the teams `get_project_vocabulary` answered |
| `labelNames` | names | replaces the whole set; see below |

`priority` and `severity` mean different things and are both worth setting on a defect: a trivial
fault on the payment screen can be urgent, and a critical fault nobody has hit can wait.

An item also carries a **resolution** once it settles — `Done`, `WontDo`, `Duplicate`, `Obsolete` —
which is written by moving it into a state that ends the work, not by an argument.

## What `update_work_item` does with what you leave out

It keeps it. Send only the fields you are changing.

That is this tool merging on your behalf: it reads the item, checks the version you sent is still the
one that is there, lays your fields over what it read, and sends the whole thing. The API underneath
replaces everything, which is why the version matters — without it the merge would be laid over an
item that may have changed.

Sending `null` for a nullable field **clears** it. Leaving the field out keeps it. The two are
different and the tool cannot tell them apart for you.

## Labels replace, they do not add

`set_work_item_labels` sets the whole set. To add one:

```json
{ "referenceCode": "FUS-142", "labelNames": ["backend", "needs-design", "q1"] }
```

where the first two came from reading the item and only `q1` is new. Sending `["q1"]` alone removes
the other two. An empty list clears every label, which is a legitimate thing to want and never an
accident the tool will catch for you.

Labels are named, not numbered, and a name that matches nothing is refused with the names that do
exist. An archived label can still be carried by an item that already had it, and cannot be applied
again.

## A worked create

```json
{
  "projectKey": "FUS",
  "itemTypeName": "Story",
  "title": "Sign-in remembers the last organisation",
  "descriptionMarkdown": "A person in two organisations lands in whichever one the token happened to name.",
  "acceptanceCriteriaMarkdown": "- The last organisation is restored on sign-in\n- Switching still works",
  "priority": "High",
  "estimate": 3,
  "labelNames": ["auth"],
  "changeSetId": "0f8f7b1a-6c2e-4a3d-9c14-2b7e5d6a8f30"
}
```

Only `title` is required. `itemTypeName` left out takes the organisation's default kind, which is
whatever it calls the ordinary unit of work; naming it is better, because the default is not
something every organisation has.

## Delete, restore, archive

`delete_work_item` is a **soft** delete: the item is stamped and kept, `restore_work_item` puts it
back, and neither takes a version. A read still answers a deleted item — carrying the date it was
deleted — so a successful `get_work_item` is not proof the item is live.

Deleting something that is already deleted is refused rather than ignored, and so is restoring
something that was never deleted.

There is no tool that archives a work item. Archiving exists on the row and is not part of this
surface; what looks like archiving in a backlog is usually a workflow state whose category is
`Cancelled`.

## Comments

`add_comment` writes on an item, or answers one comment when it names `parentCommentId`. **A thread
is exactly one level deep**: reply to a comment, never to a reply. Replying to a reply is refused,
and the refusal says to answer the comment above it instead — which is where everyone reading the
thread will look anyway.

`list_comments` answers the thread with its replies nested, plus the work items mentioned anywhere
in it.
