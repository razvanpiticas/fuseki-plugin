# Installing the GitHub command-line tool

Load this when the person said yes to installing `gh`. Planning a story can then make "the
continuous-integration workflows pass for the story's commit" a checkable part of done, with
`gh run list` and `gh run watch`.

Walk the person through these four steps, one at a time, and wait for each to finish. **The person
runs every installer and the sign-in themselves**: installing software and signing in to GitHub are
their acts, and the sign-in is interactive.

1. **Install `gh` for this machine.**

   | Machine | Command |
   | --- | --- |
   | Windows | `winget install --id GitHub.cli` |
   | macOS | `brew install gh` |
   | Linux | the package for the distribution, from `https://github.com/cli/cli#installation` |

2. **Restart the terminal**, so `gh` is on the PATH. A harness started before the install does not
   see it either: restart the harness session too when `gh --version` still answers "not found".
3. **Sign in.** Ask the person to type `! gh auth login` themselves and follow its questions.
   Never run it for them, and never ask for a token in the chat.
4. **Verify** with `gh --version` and `gh auth status`. The first names the version; the second says
   which account is signed in to `github.com`.

Then run `node "${CLAUDE_PLUGIN_ROOT}/cli/bin/fuseki.mjs" tooling check` again, and say what it recorded. When `gh auth status` still
fails, say what it printed and leave it there: the front door asks again on its next run, unless the
person declines.
