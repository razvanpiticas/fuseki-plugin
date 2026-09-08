---
name: fuseki-update
description: Moves the installed Fuseki plugin to the version published on the public mirror, and reports what changed. Use when asked to update, upgrade or refresh Fuseki, the Fuseki plugin or the Fuseki skills, when a Fuseki tool is missing or behaves unlike its documentation, or when the tools the server reports disagree with what the skills describe.
---

# Updating Fuseki

This plugin is published from Fuseki's own repository to a public mirror, and every harness installs
it from there. Nothing arrives on its own unless the harness was told to look, so a skill that
disagrees with the server is almost always a plugin that was never refreshed.

Run this whole file top to bottom. It is one act, not a menu.

## 1. Find out whether there is anything to do

The published version is the `version` field of the manifest on the mirror's default branch:

```bash
# One HTTPS GET, no credentials, no gh CLI. Answers something like 0.1.0+e50c0e722efd.
curl -fsSL https://raw.githubusercontent.com/razvanpiticas/fuseki-plugin/main/plugins/fuseki/.claude-plugin/plugin.json | grep '"version"'
```

This harness installs the skills as plain files, with no manifest and no recorded version, so there
is nothing local to compare. Treat the published version as the answer and go on to step 2.

The two strings are compared for equality, not ordered — the part after `+` is the source commit the
build was made from, so any difference at all means the installed copy is behind.

**Equal strings mean stop.** Say so and do nothing else. Reinstalling an identical version churns the
harness's cache and proves nothing.

## 2. Install the published version

Re-run the installer from the project directory. It rewrites the files it wrote before, so there is
nothing to uninstall first.

```bash
npx github:razvanpiticas/fuseki-plugin install
```

Reload the window afterwards so the rewritten skill files are read again.

## 3. Say what actually happened

Report the version it moved from and to, and name the reload the user still owes. An update that is
installed but not reloaded looks exactly like an update that did not happen, and the user is the only
one who can tell the difference from the outside.

If a command failed, give its output rather than a summary of it. The two failures worth naming:

- **The marketplace is not registered.** Nothing to update; the plugin was installed some other way,
  or under another marketplace name. Install it as the mirror's README describes rather than
  guessing at a name.
- **The refresh succeeded and the version did not move.** The publish has not finished.
  Fuseki's workflow mirrors within about a minute of a push; wait and run this again.

## What this does not do

It does not touch the Fuseki server or any of its data — it only replaces the files this
plugin installed. `server_info` is the check for whether the *server* is reachable and current, and
it answers with the deployment that responded. When the tool list it reports disagrees with what any
skill says, the tool list is right and this file is what needs running.
