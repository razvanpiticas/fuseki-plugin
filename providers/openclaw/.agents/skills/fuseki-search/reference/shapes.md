# The shapes a walk may take

Load this before `run_analytical_query`. Every shape is one `SELECT` over the property graph
`fuseki_project_graph`. Fill the placeholders and keep the project clause on the vertex you start
from: the server refuses a query that does not name the project's id there.

**The graph.** Vertices `work_item` (`id`, `project_id`, `reference_code`, `title`, `item_type_id`,
`workflow_state_id`, `parent_id`, `priority`, `estimate`, `assignee_account_id`,
`completed_at_utc`, `deleted_at_utc` and the item's other columns), `project` (`id`, `key`, `name`,
`portfolio_id`), `portfolio`, `sprint` (`id`, `project_id`, `name`, `state`) and `comment` (`id`,
`work_item_id`, `body_markdown`). Edges `link` (a link nobody rejected, from its first item to its
second in the link's own direction, with `link_type_id`, `origin`, `verdict`, `confidence`,
`magnitude`, `unit`, `is_possible_duplicate`), `parent_of` (parent to child), `sprint_contains`
(sprint to work item, with `removed_at_utc`) and `promoted_to` (idea to delivery item). Values are
stored by name: a sprint's `state` is `Planned`, `Active` or `Closed`; a link's `origin` is `Parsed`,
`Inferred` or `Declared`; its `verdict` is null (nobody has ruled) or `Confirmed` (a rejected link is no edge).

**Placeholders.** `<projectId>` — the `id` `get_project` answers for the project key.
`<code>` — a reference code. `<linkTypeId>` — a word's id: the `linkTypeId` `list_work_item_links`
answers on any link carrying that word, or the `linkTypeId` of a word `list_untyped_links` offers.
A word is never matched by its name: the graph holds only its id.

A deleted item keeps its row, so every shape below keeps `deleted_at_utc IS NULL` on the items it
answers. An unfinished item has `completed_at_utc IS NULL`.

## S1 — what blocks what blocks one item (two hops in)

```sql
SELECT * FROM GRAPH_TABLE (fuseki_project_graph
  MATCH (deeper IS work_item WHERE deeper.project_id = '<projectId>' AND deeper.deleted_at_utc IS NULL)
        -[a IS link WHERE a.link_type_id = '<blocks linkTypeId>']-> (direct IS work_item WHERE direct.deleted_at_utc IS NULL)
        -[b IS link WHERE b.link_type_id = '<blocks linkTypeId>']-> (item IS work_item WHERE item.reference_code = '<code>')
  COLUMNS (deeper.reference_code AS blocks_a_blocker, direct.reference_code AS blocker))
```

## S2 — what one item holds up, and what those hold up (two hops out)

```sql
SELECT * FROM GRAPH_TABLE (fuseki_project_graph
  MATCH (item IS work_item WHERE item.project_id = '<projectId>' AND item.reference_code = '<code>')
        -[a IS link WHERE a.link_type_id = '<blocks linkTypeId>']-> (held IS work_item WHERE held.deleted_at_utc IS NULL)
        -[b IS link WHERE b.link_type_id = '<blocks linkTypeId>']-> (further IS work_item WHERE further.deleted_at_utc IS NULL)
  COLUMNS (held.reference_code AS held_up, further.reference_code AS held_up_next))
```

## S3 — the children of one item blocked by unfinished work of another project

```sql
SELECT * FROM GRAPH_TABLE (fuseki_project_graph
  MATCH (parent IS work_item WHERE parent.project_id = '<projectId>' AND parent.reference_code = '<code>')
        -[IS parent_of]-> (child IS work_item WHERE child.deleted_at_utc IS NULL)
        <-[l IS link WHERE l.link_type_id = '<blocks linkTypeId>']- (blocker IS work_item WHERE blocker.project_id <> '<projectId>' AND blocker.completed_at_utc IS NULL)
  COLUMNS (child.reference_code AS child, blocker.reference_code AS blocked_by))
```

## S4 — the unfinished items of the active sprint blocked by unfinished work

```sql
SELECT * FROM GRAPH_TABLE (fuseki_project_graph
  MATCH (s IS sprint WHERE s.project_id = '<projectId>' AND s.state = 'Active')
        -[c IS sprint_contains WHERE c.removed_at_utc IS NULL]-> (w IS work_item WHERE w.completed_at_utc IS NULL AND w.deleted_at_utc IS NULL)
        <-[l IS link WHERE l.link_type_id = '<blocks linkTypeId>']- (b IS work_item WHERE b.completed_at_utc IS NULL AND b.deleted_at_utc IS NULL)
  COLUMNS (s.name AS sprint, w.reference_code AS blocked, b.reference_code AS blocked_by))
```

## S5 — everything one item points at with one word (one hop, filtered)

```sql
SELECT * FROM GRAPH_TABLE (fuseki_project_graph
  MATCH (a IS work_item WHERE a.project_id = '<projectId>' AND a.reference_code = '<code>')
        -[l IS link WHERE l.link_type_id = '<linkTypeId>']-> (b IS work_item WHERE b.deleted_at_utc IS NULL)
  COLUMNS (b.reference_code AS neighbour, l.origin AS origin, l.verdict AS verdict, l.confidence AS confidence))
```

For what points at the item instead, turn the edge round: `<-[l IS link WHERE …]-`.

## S6 — the possible duplicates nobody has ruled on

```sql
SELECT * FROM GRAPH_TABLE (fuseki_project_graph
  MATCH (a IS work_item WHERE a.project_id = '<projectId>' AND a.deleted_at_utc IS NULL)
        -[l IS link WHERE l.is_possible_duplicate AND l.verdict IS NULL]-> (b IS work_item WHERE b.deleted_at_utc IS NULL)
  COLUMNS (a.reference_code AS item, b.reference_code AS possible_duplicate, l.confidence AS confidence))
```

More hops than a shape has: run one shape, take the codes it answered, run the next from them,
within the walk's three calls. Never a recursive query, never a table outside the graph, never a
`WITH`, `UNION` or subquery, never a second statement.
