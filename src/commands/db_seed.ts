import { join } from 'node:path'
import { existsSync } from 'node:fs'
import type { Command } from 'commander'
import chalk from 'chalk'
import { bootstrap, shutdown } from '../cli/bootstrap.ts'
import { freshDatabase, requireLocalEnv } from './migration_fresh.ts'
import { toSnakeCase } from '@stravigor/kernel/helpers/strings'
import BaseModel from '@stravigor/database/orm/base_model'
import { Seeder } from '@stravigor/database/database/seeder'

const SEEDERS_PATH = 'database/seeders'

export function register(program: Command): void {
  program
    .command('seed')
    .alias('db:seed')
    .description('Seed the database with records')
    .option('-c, --class <name>', 'Run a specific seeder class')
    .option('--fresh', 'Drop all tables and re-migrate before seeding')
    .action(async ({ class: className, fresh }: { class?: string; fresh?: boolean }) => {
      let db
      try {
        const { db: database, registry, introspector } = await bootstrap()
        db = database

        // Wire BaseModel so factories / seeders can use the ORM
        new BaseModel(db)

        // --fresh: reset the database first
        if (fresh) {
          requireLocalEnv('seed --fresh')

          const applied = await freshDatabase(db, registry, introspector)
          console.log(chalk.green(`\nFresh migration complete. Applied ${applied} migration(s).`))
        }

        // Resolve the seeder file
        const fileName = className
          ? toSnakeCase(className.replace(/Seeder$/i, '') || 'database') + '_seeder'
          : 'database_seeder'

        const seederPath = join(process.cwd(), SEEDERS_PATH, `${fileName}.ts`)

        if (!existsSync(seederPath)) {
          console.error(chalk.red(`Seeder not found: `) + chalk.dim(seederPath))
          console.error(
            chalk.dim(
              `  Run ${chalk.cyan(`strav generate:seeder ${className ?? 'DatabaseSeeder'}`)} to create it.`
            )
          )
          process.exit(1)
        }

        console.log(chalk.cyan(`\nSeeding database...`))

        const mod = await import(seederPath)
        const SeederClass = mod.default

        if (!SeederClass || !(SeederClass.prototype instanceof Seeder)) {
          console.error(
            chalk.red(`Error: `) + `Default export of ${fileName}.ts must extend Seeder.`
          )
          process.exit(1)
        }

        const seeder = new SeederClass(db) as Seeder
        await seeder.run()

        console.log(chalk.green('Database seeding complete.'))
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : err}`))
        process.exit(1)
      } finally {
        if (db) await shutdown(db)
      }
    })
}
