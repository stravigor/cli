import { readdirSync, existsSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import type { Command } from 'commander'
import chalk from 'chalk'

/**
 * Discovers and registers CLI commands from two sources:
 *
 * 1. **Package commands** — installed `@stravigor/*` packages that declare
 *    `"strav": { "commands": "src/commands" }` in their `package.json`.
 * 2. **User commands** — `.ts` files in a `./commands/` directory at the
 *    project root.
 *
 * Every discovered file must export a `register(program: Command): void`
 * function.
 *
 * @example
 * // In strav.ts:
 * await CommandLoader.discover(program)
 *
 * @example
 * // In a package (e.g. @stravigor/search):
 * // package.json: { "strav": { "commands": "src/commands" } }
 * // src/commands/search_import.ts:
 * export function register(program: Command): void {
 *   program.command('search:import <model>').action(async () => { ... })
 * }
 *
 * @example
 * // User-defined command:
 * // commands/deploy.ts:
 * export function register(program: Command): void {
 *   program.command('deploy').action(async () => { ... })
 * }
 */
export default class CommandLoader {
  /**
   * Discover and register commands from packages and the user's commands directory.
   *
   * @param baseDir - Project root directory. Defaults to `process.cwd()`.
   */
  static async discover(program: Command, baseDir?: string): Promise<void> {
    const root = baseDir ?? process.cwd()
    await this.loadPackageCommands(program, root)
    await this.loadUserCommands(program, root)
  }

  // ── Package commands ───────────────────────────────────────────────────

  private static async loadPackageCommands(program: Command, root: string): Promise<void> {
    const packages = await this.resolvePackages(root)

    for (const { root: pkgRoot, commandsDir } of packages) {
      try {
        const dir = join(pkgRoot, commandsDir)
        if (!dirExists(dir)) continue

        const files = readdirSync(dir).filter(f => f.endsWith('.ts'))
        for (const file of files) {
          const filePath = join(dir, file)
          try {
            const module = await import(filePath)
            if (typeof module.register === 'function') {
              module.register(program)
            }
          } catch (err) {
            console.error(
              chalk.yellow(
                `Warning: Failed to load command "${file}": ${err instanceof Error ? err.message : err}`
              )
            )
          }
        }
      } catch {
        // Skip packages whose commands directory can't be read
      }
    }
  }

  // ── User commands ──────────────────────────────────────────────────────

  private static async loadUserCommands(program: Command, root: string): Promise<void> {
    const userDir = join(root, 'commands')
    if (!dirExists(userDir)) return

    const files = readdirSync(userDir).filter(f => f.endsWith('.ts'))

    for (const file of files) {
      const filePath = join(userDir, file)
      try {
        const module = await import(filePath)
        if (typeof module.register === 'function') {
          module.register(program)
        }
      } catch (err) {
        console.error(
          chalk.yellow(
            `Warning: Failed to load command "${file}": ${err instanceof Error ? err.message : err}`
          )
        )
      }
    }
  }

  // ── Package resolution ─────────────────────────────────────────────────

  private static async resolvePackages(
    root: string
  ): Promise<Array<{ root: string; commandsDir: string }>> {
    const results: Array<{ root: string; commandsDir: string }> = []
    const seen = new Set<string>()

    // 1. Check node_modules/@stravigor/*
    const nodeModulesDir = join(root, 'node_modules', '@stravigor')
    if (dirExists(nodeModulesDir)) {
      const dirs = readdirSync(nodeModulesDir)
      for (const dir of dirs) {
        const pkgRoot = join(nodeModulesDir, dir)
        const realRoot = realPath(pkgRoot)
        if (seen.has(realRoot)) continue
        seen.add(realRoot)
        const commandsDir = await readStravCommands(pkgRoot)
        if (commandsDir) results.push({ root: pkgRoot, commandsDir })
      }
    }

    // 2. Check Bun workspace packages
    try {
      const rootPkgPath = join(root, 'package.json')
      if (existsSync(rootPkgPath)) {
        const rootPkg = await Bun.file(rootPkgPath).json()
        const workspaces: string[] = rootPkg.workspaces ?? []
        for (const ws of workspaces) {
          const wsPath = join(root, ws)
          const realRoot = realPath(wsPath)
          if (seen.has(realRoot)) continue
          seen.add(realRoot)
          const commandsDir = await readStravCommands(wsPath)
          if (commandsDir) results.push({ root: wsPath, commandsDir })
        }
      }
    } catch {
      // No package.json or not in a workspace
    }

    return results
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Resolve symlinks to avoid double-loading workspace packages. */
function realPath(p: string): string {
  try {
    return realpathSync(p)
  } catch {
    return p
  }
}

function dirExists(path: string): boolean {
  try {
    readdirSync(path)
    return true
  } catch {
    return false
  }
}

/** Read the `strav.commands` field from a package's `package.json`. */
async function readStravCommands(packageRoot: string): Promise<string | null> {
  try {
    const pkgPath = join(packageRoot, 'package.json')
    if (!existsSync(pkgPath)) return null
    const pkg = await Bun.file(pkgPath).json()
    return pkg?.strav?.commands ?? null
  } catch {
    return null
  }
}
