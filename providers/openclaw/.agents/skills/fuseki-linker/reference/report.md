# The report

## In session — one line per link, handed to the calling skill

One line each, in the order typed, then the ones left alone:

```
Typed 2 links from this change set:
  FUS-9 → FUS-12: blocks (0.88) — the invoice cannot be marked paid until the payment webhook exists
  FUS-14 — FUS-15: relates to (0.86) — both are about invoice reminders, and neither waits for the other
Left alone 1:
  FUS-3 ~ FUS-4: possible duplicate (0.98) — "Export invoices to a CSV file" and "Export the invoices as a CSV file"
```

The arrow shows the direction as typed; `—` a symmetric word; `~` a pair left untyped. The number is
the confidence the embedder gave. The clause after the dash is your sentence, so the person can
disagree with it in one read. Report what `type_link` answered, by code.

When the list is empty: "Nothing to type yet from this change set; the Weekly linker catches what is
not embedded yet." Nothing else is called.

## Over the whole project — the digest

Written as the change set's summary: by `fuseki-routines` when the Weekly linker fired, by you when a
person asked. Handed the routine's change set, you write the digest as your answer only and never
send it with `complete_change_set`: that change set is not yours to close. Counts first, then the lists:

```
Links on FUS: 14 read, 11 typed, 2 possible duplicates left for a person, 1 left untyped.
Words used: blocks 5, relates to 3, causes 2, is tested by 1 (new — "The first item is checked by the work the second item describes. …").
Typed:
  <one line per link, as above>
Possible duplicates (rule on the links screen):
  <one line per pair>
Left untyped:
  FUS-21 ~ FUS-30: rejected by a person under causes; no other word fits
```

After every page, `observe_change_set` with one line: "page 2: 25 read, 21 typed, 2 duplicates,
2 left". The digest is what the person reads on the runs screen; the lines in it are what they will
see on the links screen, where they confirm or reject each typed link. Nothing else is sent.
