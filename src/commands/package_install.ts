import { readdirSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import type { Command } from 'commander'
import chalk from 'chalk'

export function register(program: Command): void {
  program
    .command('install <name>')
    .aliases(['package:install', 'i'])
    .description('Copy config and schema stubs from a @stravigor/* package into your project')
    .option('-f, --force', 'Overwrite existing files')
    .action(async (name: string, { force }: { force?: boolean }) => {
      try {
        const packageName = name.startsWith('@stravigor/') ? name : `@stravigor/${name}`

        const packageRoot = await resolvePackageRoot(packageName)
        if (!packageRoot) {
          console.error(chalk.red(`Package "${packageName}" is not installed.`))
          process.exit(1)
        }

        const stubsDir = join(packageRoot, 'stubs')
        if (!dirExists(stubsDir)) {
          console.log(chalk.yellow(`Package "${packageName}" has no stubs to install.`))
          return
        }

        let copied = 0
        let skipped = 0

        // Copy config stubs → ./config/
        const configStubsDir = join(stubsDir, 'config')
        if (dirExists(configStubsDir)) {
          const result = await copyStubs(configStubsDir, join(process.cwd(), 'config'), force)
          copied += result.copied
          skipped += result.skipped
        }

        // Copy schema stubs → ./database/schemas/
        const schemaStubsDir = join(stubsDir, 'schemas')
        if (dirExists(schemaStubsDir)) {
          const result = await copyStubs(
            schemaStubsDir,
            join(process.cwd(), 'database', 'schemas'),
            force
          )
          copied += result.copied
          skipped += result.skipped
        }

        // Copy action stubs → ./actions/
        const actionStubsDir = join(stubsDir, 'actions')
        if (dirExists(actionStubsDir)) {
          const result = await copyStubs(actionStubsDir, join(process.cwd(), 'actions'), force)
          copied += result.copied
          skipped += result.skipped
        }

        // Copy email template stubs → ./resources/views/emails/
        const emailStubsDir = join(stubsDir, 'emails')
        if (dirExists(emailStubsDir)) {
          const result = await copyStubs(
            emailStubsDir,
            join(process.cwd(), 'resources', 'views', 'emails'),
            force,
            ['.strav']
          )
          copied += result.copied
          skipped += result.skipped
        }

        if (copied === 0 && skipped === 0) {
          console.log(chalk.yellow(`No stubs found in "${packageName}".`))
        } else {
          if (copied > 0) {
            console.log(
              chalk.green(`\nInstalled ${copied} file${copied > 1 ? 's' : ''} from ${packageName}.`)
            )
          }
          if (skipped > 0) {
            console.log(
              chalk.dim(
                `Skipped ${skipped} existing file${skipped > 1 ? 's' : ''}. Use --force to overwrite.`
              )
            )
          }
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : err}`))
        process.exit(1)
      }
    })
}

async function resolvePackageRoot(packageName: string): Promise<string | null> {
  // 1. Try node_modules (regular npm install)
  const nodeModulesPath = join(process.cwd(), 'node_modules', ...packageName.split('/'))
  if (existsSync(join(nodeModulesPath, 'package.json'))) {
    return nodeModulesPath
  }

  // 2. Try workspace resolution (Bun workspaces / monorepo)
  try {
    const rootPkg = await Bun.file(resolve('package.json')).json()
    const workspaces: string[] = rootPkg.workspaces ?? []
    for (const ws of workspaces) {
      const wsPath = resolve(ws)
      const pkgPath = join(wsPath, 'package.json')
      if (!existsSync(pkgPath)) continue
      const wsPkg = await Bun.file(pkgPath).json()
      if (wsPkg.name === packageName) return wsPath
    }
  } catch {
    // No package.json or no workspaces
  }

  return null
}

function dirExists(path: string): boolean {
  try {
    readdirSync(path)
    return true
  } catch {
    return false
  }
}

async function copyStubs(
  srcDir: string,
  destDir: string,
  force?: boolean,
  extensions: string[] = ['.ts']
): Promise<{ copied: number; skipped: number }> {
  let copied = 0
  let skipped = 0

  const files = readdirSync(srcDir).filter(f => extensions.some(ext => f.endsWith(ext)))

  for (const file of files) {
    const srcPath = join(srcDir, file)
    const destPath = join(destDir, file)
    const destFile = Bun.file(destPath)

    if ((await destFile.exists()) && !force) {
      const relative = destPath.replace(process.cwd() + '/', '')
      console.log(chalk.yellow(`  SKIP  ${relative} (already exists)`))
      skipped++
      continue
    }

    mkdirSync(destDir, { recursive: true })
    const content = await Bun.file(srcPath).text()
    await Bun.write(destPath, content)
    const relative = destPath.replace(process.cwd() + '/', '')
    console.log(chalk.green(`  CREATE  ${relative}`))
    copied++
  }

  return { copied, skipped }
}
