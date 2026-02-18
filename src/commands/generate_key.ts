import { join } from 'node:path'
import type { Command } from 'commander'
import chalk from 'chalk'

export function register(program: Command): void {
  program
    .command('generate:key')
    .alias('g:key')
    .description('Generate an APP_KEY and write it to the .env file')
    .option('-f, --force', 'Overwrite existing APP_KEY if present')
    .action(async ({ force }: { force?: boolean }) => {
      try {
        const key = crypto.randomUUID()
        const envPath = join(process.cwd(), '.env')
        const file = Bun.file(envPath)

        if (await file.exists()) {
          const contents = await file.text()
          const hasKey = /^APP_KEY\s*=/m.test(contents)

          if (hasKey && !force) {
            const current = contents.match(/^APP_KEY\s*=\s*(.*)$/m)?.[1] ?? ''
            if (current) {
              console.log(chalk.yellow('APP_KEY already exists in .env. Use --force to overwrite.'))
              return
            }
          }

          if (hasKey) {
            const updated = contents.replace(/^APP_KEY\s*=.*$/m, `APP_KEY=${key}`)
            await Bun.write(envPath, updated)
          } else {
            const separator = contents.endsWith('\n') ? '' : '\n'
            await Bun.write(envPath, contents + separator + `APP_KEY=${key}\n`)
          }
        } else {
          await Bun.write(envPath, `APP_KEY=${key}\n`)
        }

        console.log(chalk.green('APP_KEY generated successfully.'))
        console.log(chalk.dim(`  ${key}`))
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : err}`))
        process.exit(1)
      }
    })
}
