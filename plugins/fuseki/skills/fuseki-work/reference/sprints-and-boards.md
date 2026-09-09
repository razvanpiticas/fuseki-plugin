# Sprints and boards

Sprints exist only on a project whose methodology is `Scrum`. A Kanban project refuses every sprint
call rather than answering an empty list, and the refusal says so — `get_project` tells you which
kind of project you are in before you find out the expensive way.

## What a sprint's state allows

A sprint is `Planned`, then `Active`, then `Closed`, one direction only. What may be changed narrows
at each step.

| | Name | Goal | Start date | End date | Capacity | Add or remove work | Start it | Close it |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `Planned` | yes | yes | yes | yes | yes | yes | yes | no — it has not started |
| `Active` | yes | yes | **no** | yes | yes | yes | no — already running | yes |
| `Closed` | no | no | no | no | no | **no** | no | no — already closed |

An `Active` sprint's start date is fixed because it happened. Everything else about it is still
negotiable, including its end date — a sprint can be extended.

`update_sprint` is partial here: send what you are changing. There is no version on a sprint, so two
people editing one at the same time is last-write-wins and nothing detects it.

## Reading one

`get_sprint` answers the sprint **and the work in it**, including memberships that have been
removed — each says when it was added, whether it was committed to at the start, when it was removed
if it was, and which sprint it was carried over from if any. There is no separate call for a
sprint's items.

Its report and its burndown come back only once the sprint has started. A `Planned` sprint has
neither, and that is an absence rather than a failure.

## Adding and removing work

`add_to_sprint` and `remove_from_sprint` both take many reference codes at once and both answer the
**whole** sprint backlog, not just what changed.

```json
{ "sprintId": "3a1b...", "referenceCodes": ["FUS-142", "FUS-143", "FUS-147"] }
```

Adding something already in this sprint is refused; so is removing something that is not in it.
Adding something that is open in a **different** sprint of the same project moves it — the old
membership closes and a new one opens in the same save.

A discovery item cannot go into a sprint at all, and neither can a deleted one.

## Closing

**Call `preview_sprint_close` first.** It says exactly what would carry over and what would be left
behind, grouped by category, and it works in any state so it costs nothing to ask.

Then the rule, which is the thing people get wrong:

| Category | Carries over? |
| --- | --- |
| `Started` | **yes** |
| `Backlog` | no |
| `Unstarted` | no |
| `Completed` | no |
| `Cancelled` | no |

**Only work that was actually begun carries.** Work that was committed to and never started is left
behind in the closed sprint, not moved forward — which surprises people, and is why the preview
exists.

`close_sprint` may carry into a sprint you name, or into one it creates for you. It creates one only
when there is something to carry; if nothing carries, no next sprint is made. A project with no
default sprint length and work to carry is refused, because there is no cadence to propose dates
from — set one on the project first.

Closing is not reversible and it moves work somebody committed to. Show the preview and ask.

## Boards

`list_boards` answers a project's boards; `get_board` answers one with its columns; the cards come
back with it. Cards are flat and ungrouped — the board says which strategy it groups by
(`None`, `Assignee`, `Team`, `Epic`, `Feature`, `Priority`, `Label`, `Project`) and whatever draws
it does the grouping.

A card whose workflow state maps to no column sits in no column, which a board shows as unmapped.
Work-in-progress limits are advisory: a column says whether it is over or under, and nothing is
refused for exceeding one.

Boards are read-only on this surface. Moving a card means moving the item —
`transition_work_item` for the column, `move_work_item` for the order within it.
