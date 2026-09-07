import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

/**
 * How each harness is recognised on a machine.
 *
 * A harness is detected from a directory it creates itself, never from one this installer could
 * have created on a previous run — otherwise installing once makes every later run believe that
 * harness is present. `.agents` is deliberately absent for this reason: both Codex and OpenClaw
 * read it, neither is the only thing that writes it, and a wrong guess installs into a harness the
 * user does not have.
 */
const DETECTION_MARKERS = Object.freeze({
  cursor: { home: [".cursor"], project: [] },
  gemini: { home: [".gemini"], project: [] },
  opencode: { home: [join(".config", "opencode")], project: ["opencode.json", "opencode.jsonc"] },
  openclaw: { home: [".openclaw"], project: [] },
  hermes: { home: [".hermes"], project: [] },
})

/**
 * Reports which harnesses this machine appears to have.
 *
 * Detection is a suggestion, never a decision: the installer still asks before writing anything,
 * because a marker directory proves a harness was installed once, not that it is the one being
 * used now.
 *
 * @param {string} projectDirectory absolute path to the project being installed into
 * @returns {string[]} detected provider ids
 */
export const detectHarnesses = (projectDirectory) => {
  if (!projectDirectory) throw new Error("detectHarnesses requires the project directory.")

  const home = homedir()

  return Object.entries(DETECTION_MARKERS)
    .filter(([, markers]) => {
      const inHome = markers.home.some((marker) => existsSync(join(home, marker)))
      const inProject = markers.project.some((marker) => existsSync(join(projectDirectory, marker)))

      return inHome || inProject
    })
    .map(([providerId]) => providerId)
}

/** Every provider id the installer can place a tree for. */
export const DETECTABLE_PROVIDER_IDS = Object.freeze(Object.keys(DETECTION_MARKERS))
