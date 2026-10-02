# Writing a routine's instructions

Load this when the person adds a routine or edits one's instructions on the Routines tab, and asks
what to write. You show the text; the person types it.

A routine's instructions are read by a harness the machine's scheduler started, literally, with
nobody in the window. The two the product ships are the models; read them with `get_routine` before
writing one.

- **Second person, to the agent.** "Use the fuseki-linker skill on this project …", "Read …",
  "Report … in the digest".
- **Every step names something that exists** — a tool, a skill, a screen. A step that points at a
  thing the product does not have fails on every firing and tells nobody.
- **Leave the run to fuseki-routines.** It opens the change set naming the routine before the first
  step and completes it with the digest after the last; the instructions say what to do in between,
  and what belongs in the digest.
- **Nobody is in the window.** What needs a person goes into the digest, which lands in their inbox
  as the run report. The routine never waits in the chat, and never asks.
- **Say what it decides: nothing.** It writes, it proposes, a person rules — on the links screen, on
  a skill definition's Guidance tab.
- **One thing per firing.** A second thing is a second routine, or next week's firing.

Shape: one sentence naming the skill or the tools and the scope; what it does; what it never does;
what goes in the digest. The Weekly linker's reads:

> Use the fuseki-linker skill on this project with no change set scope: give every untyped related
> link its word. Confirm nothing, reject nothing, merge nothing. Report the possible duplicates and
> any new words in the digest.
