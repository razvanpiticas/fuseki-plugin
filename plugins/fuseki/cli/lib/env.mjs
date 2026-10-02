import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

import { ENV_TEMPLATE_FILE_NAME, readBundledFile } from "./bundled.mjs"
import { ENV_FILE_LABEL, envPathOf, readState, readTemplate, writeStateWhenChanged } from "./state-document.mjs"

/**
 * `fuseki env` — the test account a repository's browser checks sign in with, in `.fuseki/.env`.
 *
 * <p>The one credential the plugin handles, and it never passes through this tool. `init` writes the
 * file with blank keys, for the person to fill by hand; `check` reads it and reports which keys hold
 * something, by name. <b>No value is ever printed, written to the state, or put in an error</b>: a
 * line this tool cannot read is named by its number, never quoted, because the line may be the
 * password.</p>
 */

/** The command this module answers to, as `fuseki.mjs` dispatches it. */
export const ENV_COMMAND = "env"

/** What `env` can be asked to do. */
export const ENV_ACTIONS = Object.freeze({ INIT: "init", CHECK: "check" })

/** A comment line, which carries no key. */
const COMMENT_PREFIX = "#"

/** The shell's word some env files open a line with, which changes nothing about the key. */
const EXPORT_PREFIX = "export "

/** `KEY=value`, the key a shell variable name. */
const ASSIGNMENT_PATTERN = /^(?<key>[A-Za-z_][A-Za-z0-9_]*)\s*=(?<value>.*)$/

/** A value wrapped in a pair of the same quote, which is the value without them. */
const QUOTED_VALUE_PATTERN = /^(?<quote>["'])(?<inner>.*)\k<quote>$/

/**
 * Runs one `env` call.
 *
 * @param {string[]} argv everything after the word `env`
 * @param {{repositoryDirectory: string, bundledDirectory: string}} context
 * @returns {string[]} the lines to print
 */
export const runEnv = (argv, context) => {
  if (argv.length !== 1 || !Object.values(ENV_ACTIONS).includes(argv[0])) {
    throw new Error(`env does not know "${argv.join(" ")}". It is one of: fuseki env init | fuseki env check.`)
  }

  return argv[0] === ENV_ACTIONS.INIT ? initEnv(context) : checkEnv(context)
}

/**
 * Writes `.fuseki/.env` from the template when it is missing, never over an existing one, and
 * records that the app needs a sign-in and where its test account is kept.
 */
export const initEnv = ({ repositoryDirectory, bundledDirectory }) => {
  const before = readState(repositoryDirectory, readTemplate(bundledDirectory))
  const path = envPathOf(repositoryDirectory)
  const lines = []

  if (existsSync(path)) {
    lines.push(`Kept the existing ${ENV_FILE_LABEL}; it is never overwritten.`)
  } else {
    const template = readBundledFile(bundledDirectory, ENV_TEMPLATE_FILE_NAME)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, template, "utf8")
    lines.push(`Created ${ENV_FILE_LABEL} with blank keys: ${readKeys(template).map((entry) => entry.key).join(", ")}.`)
    lines.push("Open it and fill them in yourself. Nothing here asks for them, reads them aloud or prints them.")
  }

  const document = structuredClone(before)
  document.uiTesting.envFile = ENV_FILE_LABEL
  document.uiTesting.requiresSignIn = true
  writeStateWhenChanged(repositoryDirectory, before, document)

  return lines
}

/**
 * Reads `.fuseki/.env` and records the names of the keys that hold a non-blank value.
 *
 * @throws when the file is missing, naming `fuseki env init`, or when a line is neither a comment nor
 *         an assignment, naming the line by its number alone
 */
export const checkEnv = ({ repositoryDirectory, bundledDirectory }) => {
  const before = readState(repositoryDirectory, readTemplate(bundledDirectory))
  const path = envPathOf(repositoryDirectory)
  if (!existsSync(path)) throw new Error(`There is no ${ENV_FILE_LABEL}. Run fuseki env init first, then fill it in.`)

  const entries = readKeys(readFileSync(path, "utf8"))
  const filled = entries.filter((entry) => entry.filled).map((entry) => entry.key)
  const blank = entries.filter((entry) => !entry.filled).map((entry) => entry.key)

  const document = structuredClone(before)
  document.uiTesting.envKeysPresent = filled
  writeStateWhenChanged(repositoryDirectory, before, document)

  return [
    `Filled in ${ENV_FILE_LABEL}: ${filled.length > 0 ? filled.join(", ") : "none"}.`,
    `Blank: ${blank.length > 0 ? blank.join(", ") : "none"}.`,
  ]
}

/** Every key the text assigns, with whether its value is non-blank. Never the value itself. */
const readKeys = (text) =>
  text
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => line.length > 0 && !line.startsWith(COMMENT_PREFIX))
    .map(({ line, number }) => {
      const assignment = ASSIGNMENT_PATTERN.exec(line.startsWith(EXPORT_PREFIX) ? line.slice(EXPORT_PREFIX.length).trim() : line)
      if (assignment === null) {
        throw new Error(`Line ${number} of ${ENV_FILE_LABEL} is not KEY=value. Its text is not shown here, because it may hold a credential.`)
      }

      const value = assignment.groups.value.trim()
      const quoted = QUOTED_VALUE_PATTERN.exec(value)

      return { key: assignment.groups.key, filled: (quoted === null ? value : quoted.groups.inner).trim().length > 0 }
    })
