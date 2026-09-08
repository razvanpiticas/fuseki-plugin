#!/usr/bin/env node

/**
 * Tells the user, at the start of a session, that a newer Fuseki plugin has been published.
 *
 * Nothing we publish can switch a user's auto-update on — that setting lives in their own
 * `~/.claude/settings.json`, and neither the marketplace manifest nor the plugin has a field that
 * reaches it. So the plugin does the one thing it can do from inside their machine: notice, and
 * say so. Without this, a stale plugin is silent, and the first sign of it is a skill describing
 * tools the server does not have.
 *
 * <b>The check never runs in the foreground.</b> SessionStart delays the session until every hook
 * returns, and a network call on a bad connection would hold the prompt for as long as the timeout.
 * Instead this reads the answer the *previous* session left behind, says its piece immediately, and
 * spawns a detached process to refresh the file for next time. The cost of that is one session's
 * lag on the very first notice, which is worth paying to never delay a prompt.
 *
 * It speaks on two channels because they reach different readers:
 * - `systemMessage` is shown to the person. They are the one who decides to update.
 * - `additionalContext` is given to the model, so "update fuseki" is understood without a search.
 *
 * Failures are swallowed on purpose, and this is the one place in this repository where that is
 * right: the hook runs before every session, it is not part of any result the user asked for, and
 * a plugin that prints a red error because a laptop was offline is worse than one that stays quiet.
 * A silent check reverts the session to how it behaved before this file existed.
 */

import { spawn } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

/** Argument that puts this file in its background half rather than its foreground half. */
const REFRESH_ARGUMENT = "--refresh"

/** Name of the file the two halves talk through, inside the plugin's persistent data directory. */
const CACHE_FILENAME = "update-check.json"

/** How long an answer stays good. A session started inside this window does not re-check. */
const CACHE_LIFETIME_MS = 6 * 60 * 60 * 1000

/** Cap on the version fetch. The background half is detached, so nothing waits on it but itself. */
const FETCH_TIMEOUT_MS = 10_000

/** Prefix the manifest's repository URL carries, and the only host this knows how to ask. */
const GITHUB_URL_PREFIX = "https://github.com/"

/**
 * Turns the manifest's repository URL into the raw address of the published manifest.
 *
 * Answers null for anything that is not a GitHub URL rather than guessing at another host's raw
 * layout — a wrong address here would report "no update" forever and look exactly like being
 * up to date.
 */
const publishedManifestUrl = (repository) => {
  if (typeof repository !== "string" || !repository.startsWith(GITHUB_URL_PREFIX)) return null

  const path = repository.slice(GITHUB_URL_PREFIX.length).replace(/\.git$/, "").replace(/\/$/, "")
  if (path.split("/").length !== 2) return null

  return `https://raw.githubusercontent.com/${path}/main/plugins/fuseki/.claude-plugin/plugin.json`
}

const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT
const pluginData = process.env.CLAUDE_PLUGIN_DATA

/**
 * Reads a JSON file, or answers null.
 *
 * Null rather than a throw because every caller here treats "could not read it" and "it was not
 * there" the same way: say nothing this session.
 */
const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    return null
  }
}

/** The manifest of the installed copy. It carries both the version and the repository to ask. */
const readOwnManifest = () => readJson(join(pluginRoot, ".claude-plugin", "plugin.json"))

/**
 * Fetches the published version and records it.
 *
 * The repository is read from the installed manifest rather than written here, so the address this
 * asks and the address the plugin was published from cannot drift apart.
 */
const refresh = async () => {
  const url = publishedManifestUrl(readOwnManifest()?.repository)
  if (!url) return

  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) return

  const published = await response.json()
  if (typeof published?.version !== "string") return

  mkdirSync(pluginData, { recursive: true })
  writeFileSync(
    join(pluginData, CACHE_FILENAME),
    JSON.stringify({ latest: published.version, checked: Date.now() }),
    "utf8",
  )
}

/** Starts the background half and lets go of it, so this process can exit now rather than later. */
const startRefresh = () => {
  // fileURLToPath, not URL.pathname: on Windows that answers "/C:/..." with a leading slash, which
  // node cannot run. The refresh then fails silently and the check never reports anything, ever.
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), REFRESH_ARGUMENT], {
    stdio: "ignore",
    windowsHide: true,
    detached: true,
  })
  child.unref()
}

/**
 * Says whether a newer version is published, using only what is already on disk.
 *
 * Compared for equality rather than ordered: the part after `+` is the source commit the build was
 * made from, so any difference at all means the installed copy is behind.
 */
const report = () => {
  const manifest = readOwnManifest()
  const installed = manifest?.version
  if (typeof installed !== "string") return

  const cache = readJson(join(pluginData, CACHE_FILENAME))
  const latest = cache?.latest
  if (typeof latest !== "string" || latest === installed) return

  // Plain hyphen, not an em dash: this string is printed straight into a terminal, and a Windows
  // console on a legacy code page renders a multi-byte dash as three characters of noise.
  const message = `Fuseki ${latest} is available - you have ${installed}. Ask me to "update fuseki" and I will do it.`

  process.stdout.write(
    `${JSON.stringify({
      systemMessage: message,
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext:
          `The installed Fuseki plugin is ${installed} and ${latest} is published. If the user asks to ` +
          "update Fuseki, or hits a Fuseki tool that does not match what a skill describes, run the " +
          "fuseki-update skill. Do not offer this unprompted more than once in a session.",
      },
    })}\n`,
  )
}

/** True when the recorded answer is recent enough that asking again would tell us nothing new. */
const cacheIsFresh = () => {
  const cache = readJson(join(pluginData, CACHE_FILENAME))
  return typeof cache?.checked === "number" && Date.now() - cache.checked < CACHE_LIFETIME_MS
}

const main = async () => {
  // Both are exported for every hook a plugin ships. Missing means this is not running as an
  // installed plugin, and there is no install to compare or anywhere durable to record the answer.
  if (!pluginRoot || !pluginData) return

  if (process.argv.includes(REFRESH_ARGUMENT)) {
    await refresh()
    return
  }

  report()
  if (!cacheIsFresh()) startRefresh()
}

try {
  await main()
} catch {
  // Deliberately silent. See the note at the top of this file.
}
