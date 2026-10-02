import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

import { answeredYes } from "./run-program.mjs"
import { readState, readTemplate, writeStateWhenChanged } from "./state-document.mjs"

/**
 * `fuseki tooling check` — what this repository and this machine offer for browser testing, version
 * control and continuous integration, written to `uiTesting.playwrightCli` and `repository`.
 *
 * <p>Every value is detected again on every run: the files and the commands on disk win over what
 * the state says. It installs nothing and runs nothing interactive; installing and signing in are
 * the person's acts, guided by the skill. A tool that does not answer is recorded as unavailable, and
 * the command still exits zero, because "not installed" is an answer.</p>
 *
 * <p>The only things carried over from the state are the `declined` flags, which record what a
 * person said and which no command on this machine can detect. A section's `checkedAtUtc` moves only
 * when what was detected differs from what was recorded, so a run that finds nothing new leaves the
 * file byte for byte as it was.</p>
 */

/** The command this module answers to, as `fuseki.mjs` dispatches it. */
export const TOOLING_COMMAND = "tooling"

/** The one thing `tooling` can be asked to do. */
export const TOOLING_CHECK_ACTION = "check"

/** Continuous-integration providers, as `repository.cicd.provider` records them. */
export const CICD_PROVIDERS = Object.freeze({ GITHUB_ACTIONS: "github-actions", OTHER: "other", NONE: "none" })

/** Where GitHub Actions keeps its workflows, and the extensions a workflow file has. */
const GITHUB_WORKFLOWS_DIRECTORY = ".github/workflows"
const WORKFLOW_EXTENSIONS = Object.freeze([".yml", ".yaml"])

/** One file each other provider is configured by, at the repository root. */
const OTHER_PROVIDER_FILES = Object.freeze([".gitlab-ci.yml", "azure-pipelines.yml", "Jenkinsfile", ".circleci/config.yml"])

/** The origin remote's HEAD, as `git symbolic-ref` names it, before the branch. */
const ORIGIN_HEAD_PREFIX = "refs/remotes/origin/"

/** A GitHub remote in any of the three ways git writes one, with its owner and name. */
const GITHUB_REMOTE_PATTERN = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)(?<owner>[^/]+)\/(?<name>[^/]+?)(?:\.git)?\/?$/

/** A version number in a tool's answer: `0.0.58`, `gh version 2.76.1 (2025-07-23)`. */
const VERSION_PATTERN = /\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?/

/**
 * Runs `tooling check`.
 *
 * @param {string[]} argv everything after the word `tooling`
 * @param {{repositoryDirectory: string, bundledDirectory: string, run: function, now: Date}} context
 * @returns {string[]} the lines to print
 */
export const runTooling = (argv, context) => {
  if (argv[0] !== TOOLING_CHECK_ACTION || argv.length !== 1) {
    throw new Error(`tooling does not know "${argv.join(" ")}". It takes one action: fuseki tooling check.`)
  }

  return checkTooling(context)
}

/** Detects everything, writes it to the state, and says what it found. */
export const checkTooling = ({ repositoryDirectory, bundledDirectory, run, now }) => {
  if (!(now instanceof Date)) throw new Error("checkTooling requires the moment of the check.")

  const before = readState(repositoryDirectory, readTemplate(bundledDirectory))
  const document = structuredClone(before)
  const checkedAtUtc = now.toISOString()
  const ask = (program, args) => run(program, args, { cwd: repositoryDirectory })

  const playwright = detectPlaywrightCli(ask)
  document.uiTesting.playwrightCli = stamped(before.uiTesting.playwrightCli, { ...playwright, declined: before.uiTesting.playwrightCli.declined }, checkedAtUtc)

  const git = detectGit(ask)
  const ghCli = detectGhCli(ask)
  const cicd = detectCicd(repositoryDirectory)

  document.repository = {
    hasGit: git.hasGit,
    remoteUrl: git.remoteUrl,
    defaultBranch: git.defaultBranch,
    github: {
      ghCli: stamped(before.repository.github.ghCli, { ...ghCli, declined: before.repository.github.ghCli.declined }, checkedAtUtc),
      repository: githubRepositoryOf(git.remoteUrl),
    },
    cicd: stamped(before.repository.cicd, cicd, checkedAtUtc),
  }

  writeStateWhenChanged(repositoryDirectory, before, document)

  return describeFindings(document)
}

/** `playwright-cli --version`: available only when it answered, with the version it named. */
const detectPlaywrightCli = (ask) => {
  const answer = ask("playwright-cli", ["--version"])
  if (!answeredYes(answer)) return { available: false, version: "" }

  return { available: true, version: versionIn(answer.stdout) }
}

/** `gh --version` and `gh auth status`; signed in only when installed and the status succeeded. */
const detectGhCli = (ask) => {
  const answer = ask("gh", ["--version"])
  if (!answeredYes(answer)) return { available: false, version: "", authenticated: false }

  return { available: true, version: versionIn(answer.stdout), authenticated: answeredYes(ask("gh", ["auth", "status"])) }
}

/** Whether this is a git work tree, its origin remote and the remote's default branch. */
const detectGit = (ask) => {
  const insideWorkTree = ask("git", ["rev-parse", "--is-inside-work-tree"])
  if (!answeredYes(insideWorkTree) || insideWorkTree.stdout.trim() !== "true") return { hasGit: false, remoteUrl: "", defaultBranch: "" }

  const remote = ask("git", ["remote", "get-url", "origin"])
  const originHead = ask("git", ["symbolic-ref", `${ORIGIN_HEAD_PREFIX}HEAD`])

  return {
    hasGit: true,
    remoteUrl: answeredYes(remote) ? remote.stdout.trim() : "",
    defaultBranch: answeredYes(originHead) ? originHead.stdout.trim().slice(ORIGIN_HEAD_PREFIX.length) : "",
  }
}

/** The provider whose files the repository carries, and those files, repository-relative. */
const detectCicd = (repositoryDirectory) => {
  const workflowsDirectory = join(repositoryDirectory, GITHUB_WORKFLOWS_DIRECTORY)
  const workflows = existsSync(workflowsDirectory)
    ? readdirSync(workflowsDirectory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && WORKFLOW_EXTENSIONS.some((extension) => entry.name.endsWith(extension)))
        .map((entry) => `${GITHUB_WORKFLOWS_DIRECTORY}/${entry.name}`)
        .sort()
    : []

  if (workflows.length > 0) return { provider: CICD_PROVIDERS.GITHUB_ACTIONS, workflows }

  const others = OTHER_PROVIDER_FILES.filter((file) => existsSync(join(repositoryDirectory, file)))
  if (others.length > 0) return { provider: CICD_PROVIDERS.OTHER, workflows: others }

  return { provider: CICD_PROVIDERS.NONE, workflows: [] }
}

/** `owner/name` of a GitHub remote, or empty when the remote is elsewhere or absent. */
export const githubRepositoryOf = (remoteUrl) => {
  const match = GITHUB_REMOTE_PATTERN.exec(remoteUrl)

  return match === null ? "" : `${match.groups.owner}/${match.groups.name}`
}

/**
 * A detected section with its `checkedAtUtc`: kept when it was checked before and nothing else in it
 * changed, stamped now otherwise. The key order is the template's, so the file reads the same after every write.
 */
const stamped = (recorded, detected, checkedAtUtc) => {
  const unchanged = recorded.checkedAtUtc !== "" && Object.keys(detected).every((key) => JSON.stringify(recorded[key]) === JSON.stringify(detected[key]))
  const section = {}

  for (const key of Object.keys(recorded)) section[key] = key === "checkedAtUtc" ? (unchanged ? recorded.checkedAtUtc : checkedAtUtc) : detected[key]

  return section
}

const versionIn = (text) => {
  const match = VERSION_PATTERN.exec(text)

  return match === null ? text.trim().split("\n")[0] : match[0]
}

/** What was found, one line per tool, in the words the front door repeats. */
const describeFindings = ({ uiTesting, repository }) => {
  const { playwrightCli } = uiTesting
  const { ghCli } = repository.github

  return [
    playwrightCli.available
      ? `playwright-cli ${playwrightCli.version}`
      : `playwright-cli: not on this machine${playwrightCli.declined ? " (declined)" : ""}`,
    repository.hasGit
      ? `git: yes · origin ${repository.remoteUrl || "none"} · default branch ${repository.defaultBranch || "unknown"} · GitHub ${repository.github.repository || "no"}`
      : "git: no repository here",
    ghCli.available
      ? `gh ${ghCli.version} · ${ghCli.authenticated ? "signed in" : "not signed in"}`
      : `gh: not on this machine${ghCli.declined ? " (declined)" : ""}`,
    `continuous integration: ${repository.cicd.provider}${repository.cicd.workflows.length > 0 ? ` · ${repository.cicd.workflows.join(", ")}` : ""}`,
  ]
}
