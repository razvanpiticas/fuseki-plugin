# Choosing the word

Load this at step 5 of the loop. The words come from the page's `words`; this file is how to pick
one, not a list of them.

## The test

Put the two items into one sentence that a word's description says, with both titles in it:

- "*Mark an invoice as paid when the webhook records its payment* cannot be done until *Build the
  payment webhook endpoint* is done." — the sentence a blocking word's description says, from the
  item in the way to the item it holds up.
- "*The CSV export drops the currency column* is what makes *Finance cannot reconcile the March
  invoices* happen." — a causing word, from the cause to its effect.
- "*Invoice reminders by email* and *Overdue invoice notifications* are about the same work, and
  neither waits for the other." — a word that says only that two items concern each other, read the
  same from both ends.

The description is read whole, not only its verb. Where it says what the first item or the second
must be, that end must be one, or the word does not fit however well the rest reads. A nearest fit is
no fit: go on to the next word, then to a new word, then to leaving the link untyped.

One sentence, one word. When two words fit, the narrower one wins: a word that says one item holds
the other up beats a word that says only that they concern each other. When no sentence comes after
reading both items whole, the link already says what can be said: leave it untyped and report it as
"read both, no relation beyond likeness".

## Direction

Every directed word reads from a first item to a second: "the first blocks the second", "the first
causes the second". Decide which of the two ends is the first in your sentence. The page lists the
pair as `from` and `to`:

| Your sentence's first item is | Send |
| --- | --- |
| the listed `from` | `FromTo` |
| the listed `to` | `ToFrom` |
| — the word is symmetric (`isSymmetric` true) | `FromTo` |

`ToFrom` on a symmetric word is refused: it has no direction to turn.

## Magnitude

Only on a word whose description says it carries a size, and only when the text states the size:
"delays the release by 3 days" → `magnitude` 3, `unit` days. A guess is not a magnitude. Both fields
or neither.

## A new word

Only when no word on the page makes a sentence, after reading both items whole. Then send its name as
`word` (lower case, a few plain words: `is tested by`) with `newWord`:

- `inverseName`: how it reads from the other end, "tests";
- `description`: one sentence of meaning naming the first item and the second, one of direction, one
  example — the shape of every shipped word's description on the page: "The first item is checked by
  the work the second item describes. Directed, from the thing checked to the check. A payment webhook
  is tested by an end-to-end payment test.";
- `isSymmetric`: true only when the sentence reads the same with the items swapped.

The word exists for the organisation from then on; say so in the report, with its description. A
name the page already offers is refused as a new word: use the word.

## The duplicate flag

`isPossibleDuplicate` true: the two items may be one piece of work written twice. Not typed, not
merged, not deleted: reported, with both codes and both titles, so a person rules on the links screen.

The flag is the server's, set only on the pairs that read most alike. A pair without it whose two
items describe the same work passes the test of a word that says so like any other pair: type it with
that word, from the item that repeats the work to the one it will be done under (the older one, unless
the text says otherwise). Leaving it untyped because it looks like a duplicate leaves its meaning
unsaid.

## A rejected pair

"This pair was rejected for this word; pick another or leave it." is a person's verdict on that guess.
Type the pair with a different word only when that word passes the test on its own, never as a way
past the refusal. Otherwise leave it and report "rejected by a person under `<word>`; no other word
fits".
