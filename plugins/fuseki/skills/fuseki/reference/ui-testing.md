# Installing playwright-cli

Load this when the person said yes to installing `playwright-cli`. Planning a feature writes its
browser checks as `playwright-cli` steps — open, snapshot, act, read back — and with the tool on this
machine the plan skill can run them once against the app, to prove they are runnable. A planned
story's run walks every one of its scenarios with `playwright-cli`.

Walk the person through these three steps, one at a time, and wait for each to finish. **The person
runs the installers themselves.**

1. **Install the package that ships `playwright-cli`, globally, with pnpm:**

   ```bash
   pnpm add -g @playwright/mcp
   ```

   `@playwright/mcp` is the package whose `bin` names `playwright-cli` (version 0.0.58 on the machine
   this was written against). When pnpm says its global bin directory is not set up, run
   `pnpm setup`, restart the terminal, and install again.

2. **Install a browser.** Run `playwright-cli --help`. When it names a command that installs a
   browser, run that. When it names none — 0.0.58 names none, and drives the Chrome already on the
   machine — open a page with `playwright-cli open https://example.com`; if it says no browser was
   found, install one with `pnpm dlx playwright install chrome`, then open the page again and close
   it with `playwright-cli close`.
3. **Verify** with `playwright-cli --version`.

Then run `node "${CLAUDE_PLUGIN_ROOT}/cli/bin/fuseki.mjs" tooling check` again, and say the version it recorded. A harness started
before the install may not see the new command: restart the session when the check still says it is
missing.
