import type { Command } from 'commander'
import chalk from 'chalk'
import { bootstrap, shutdown } from '../cli/bootstrap.ts'
import MigrationTracker from '@stravigor/database/database/migration/tracker'
import MigrationRunner from '@stravigor/database/database/migration/runner'

const MIGRATIONS_PATH = 'database/migrations'

export function register(program: Command): void {
  program
    .command('migrate')
    .alias('migration:run')
    .description('Run pending migrations')
    .action(async () => {
      let db
      try {
        const { db: database } = await bootstrap()
        db = database

        const tracker = new MigrationTracker(db)
        const runner = new MigrationRunner(db, tracker, MIGRATIONS_PATH)

        console.log(chalk.cyan('Running pending migrations...'))

        const result = await runner.run()

        if (result.applied.length === 0) {
          console.log(chalk.green('Nothing to migrate. All migrations are up to date.'))
          return
        }

        console.log(
          chalk.green(`\nApplied ${result.applied.length} migration(s) in batch ${result.batch}:`)
        )
        for (const version of result.applied) {
          console.log(chalk.dim(`  - ${version}`))
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : err}`))
        process.exit(1)
      } finally {
        if (db) await shutdown(db)
      }
    })
}
