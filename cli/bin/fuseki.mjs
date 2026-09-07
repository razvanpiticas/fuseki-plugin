#!/usr/bin/env node

import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { DETECTABLE_PROVIDER_IDS, detectHarnesses } from "../lib/detect-harness.mjs"
import { installTree } from "../lib/install-tree.mjs"

const INSTALL_COMMAND = "install"
const FROM_ARGUMENT = "--from"
const HARNESS_ARGUMENT = "--harness"
const DYNAMIC_REGISTRATION = "dynamic-registration"

const USAGE = `fuseki install — installs the Fuseki skill and MCP server into this project.

  fuseki install                       install for every harness detected on this machine
  fuseki install --harness cursor      install for one harness
  fuseki install --from <dir>          install from a local build instead of the published trees

Harnesses: ${DETECTABLE_PROVIDER_IDS.join(", ")}
Claude Code and Codex install from the plugin marketplace instead:
  /plugin marketplace add razvanpiticas/fuseki-plugin
  codex plugin marketplace add razvanpiticas/fuseki-plugin`

const main = () => {
  const argv = process.argv.slice(2)

  if (argv[0] !== INSTALL_COMMAND) {
    console.log(USAGE)
    return
  }

  const projectDirectory = process.cwd()
  const sourceRoot = resolveSourceRoot(argv)
  const providerIds = resolveProviderIds(argv, projectDirectory)

  if (providerIds.length === 0) {
    console.log("No supported harness detected on this machine.")
    console.log(`Name one explicitly: fuseki install ${HARNESS_ARGUMENT} <${DETECTABLE_PROVIDER_IDS.join("|")}>`)
    return
  }

  for (const providerId of providerIds) {
    const treeDirectory = join(sourceRoot, providerId)
    if (!existsSync(treeDirectory)) {
      throw new Error(`No built tree for "${providerId}" at ${treeDirectory}.`)
    }

    report(installTree({ treeDirectory, projectDirectory }))
  }

  console.log("")
  console.log("Verify: start the harness and ask it to call the fuseki server_info tool.")
  console.log("A tool list that comes back names the deployment. Anything else is in the skill's")
  console.log("reference/troubleshooting.md.")
}

const report = (result) => {
  console.log("")
  console.log(`${result.displayName}`)
  for (const skillPath of result.skillPaths) console.log(`  skill   ${skillPath}`)

  if (result.mcpWritten) {
    console.log(`  server  ${result.mcpTargetPath}`)
  } else {
    // A machine-wide configuration file is the user's, holding servers and settings this installer
    // has never seen. Printing the fragment is the only honest thing to do with it.
    console.log(`  server  NOT written — ${result.mcpTargetPath} is a machine-wide file.`)
    console.log("          Merge this into it yourself:")
    console.log("")
    for (const line of result.mcpFragment.trimEnd().split("\n")) console.log(`            ${line}`)
    console.log("")
  }

  if (result.pinning === DYNAMIC_REGISTRATION) {
    console.log("  NOTE    This harness signs in by dynamic client registration, which the Fuseki")
    console.log("          realm refuses. If sign-in fails, its config must name the OAuth client")
    console.log("          fuseki-public-client. There is no way around this from the client side.")
  }
}

/**
 * Resolves where the built trees are read from.
 *
 * By default, `providers/` beside this CLI's own directory. That is the published layout: the build
 * output *is* the package root, so `cli/` and `providers/` are siblings there. Running this file
 * from the monorepo instead needs `--from <dist>/providers`, because in the source tree the CLI
 * sits beside its own sources rather than beside a build.
 */
const resolveSourceRoot = (argv) => {
  const index = argv.indexOf(FROM_ARGUMENT)
  // fileURLToPath rather than URL.pathname: on Windows the latter yields "/C:/..." with a leading
  // slash, which resolves to a directory that does not exist.
  if (index === -1) return fileURLToPath(new URL("../../providers", import.meta.url))

  const directory = argv[index + 1]
  if (!directory) throw new Error(`${FROM_ARGUMENT} requires a directory.`)

  return resolve(directory)
}

const resolveProviderIds = (argv, projectDirectory) => {
  const index = argv.indexOf(HARNESS_ARGUMENT)
  if (index === -1) return detectHarnesses(projectDirectory)

  const providerId = argv[index + 1]
  if (!providerId) throw new Error(`${HARNESS_ARGUMENT} requires a harness. Known: ${DETECTABLE_PROVIDER_IDS.join(", ")}.`)
  if (!DETECTABLE_PROVIDER_IDS.includes(providerId)) {
    throw new Error(`Unknown harness "${providerId}". Known: ${DETECTABLE_PROVIDER_IDS.join(", ")}.`)
  }

  return [providerId]
}

try {
  main()
} catch (error) {
  console.error(`fuseki: ${error.message}`)
  process.exitCode = 1
}
