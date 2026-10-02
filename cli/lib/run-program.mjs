import { spawnSync } from "node:child_process"

/** The platform whose command-line tools are `.cmd` shims a program name alone does not reach. */
const WINDOWS = "win32"

/** The exit status `cmd` gives a command it could not find. */
const WINDOWS_NOT_FOUND_STATUS = 9009

/**
 * How long one program may take to answer before it is taken as not answering. `gh auth status`
 * asks GitHub over the network, and a machine offline must still finish the check.
 */
const ANSWER_TIMEOUT_MILLISECONDS = 30_000

/**
 * Runs one program and reports what it answered, without ever throwing for the program's sake.
 *
 * <p>Every caller asks a question whose honest answer may be "not installed" or "no": `gh auth
 * status` exits 1 when nobody is signed in, `git check-ignore` exits 1 when a path is not ignored,
 * and a program that is not on the PATH does not start at all. So the exit status is returned for
 * the caller to read, and a program that could not be started answers `started: false` rather than
 * an exception. Nothing is swallowed: the caller decides what each answer means.</p>
 *
 * <p>On Windows the command goes through `cmd`, because `playwright-cli` and the other tools a
 * package manager installs are `.cmd` shims that `spawn` does not find by name. The arguments every
 * caller passes are fixed words of this tool, never text a person typed, so the command line is
 * joined rather than escaped.</p>
 *
 * @param {string} program the program's name, as it is typed in a terminal
 * @param {string[]} args its arguments
 * @param {{cwd: string}} options the directory it runs in
 * @returns {{started: boolean, status: number|null, stdout: string, stderr: string}}
 */
export const runProgram = (program, args, { cwd }) => {
  if (!program) throw new Error("runProgram requires the program to run.")
  if (!Array.isArray(args)) throw new Error("runProgram requires the program's arguments.")
  if (!cwd) throw new Error("runProgram requires the directory to run in.")

  const options = { cwd, encoding: "utf8", timeout: ANSWER_TIMEOUT_MILLISECONDS, windowsHide: true }
  const result =
    process.platform === WINDOWS
      ? spawnSync([program, ...args].join(" "), { ...options, shell: true })
      : spawnSync(program, args, options)

  // cmd answers 9009 when the program is not found, which is "not installed", not an answer from it.
  const notFoundByShell = process.platform === WINDOWS && result.status === WINDOWS_NOT_FOUND_STATUS

  return {
    started: result.error === undefined && !notFoundByShell,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  }
}

/** Whether a program started and exited zero: the plain yes of a check. */
export const answeredYes = (result) => result.started && result.status === 0
