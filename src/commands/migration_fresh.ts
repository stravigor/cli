import type { Command } from 'commander'
import chalk from 'chalk'
import { createInterface } from 'node:readline'
import { rmSync } from 'node:fs'
import { bootstrap, shutdown } from '../cli/bootstrap.ts'
import type Database from '@stravigor/database/database/database'
import type SchemaRegistry from '@stravigor/database/schema/registry'
import type DatabaseIntrospector from '@stravigor/database/database/introspector'
import SchemaDiffer from '@stravigor/database/database/migration/differ'
import SqlGenerator from '@stravigor/database/database/migration/sql_generator'
import MigrationFileGenerator from '@stravigor/database/database/migration/file_generator'
import MigrationTracker from '@stravigor/database/database/migration/tracker'
import MigrationRunner from '@stravigor/database/database/migration/runner'

const MIGRATIONS_PATH = 'database/migrations'

/**
 * Drop all tables and enum types, regenerate a single migration from
 * the current schema definitions, and run it.
 *
 * Shared by `fresh` and `seed --fresh`.
 */
export async function freshDatabase(
  db: Database,
  registry: SchemaRegistry,
  introspector: DatabaseIntrospector
): Promise<number> {
  // Drop all tables in public schema
  console.log(chalk.cyan('\nDropping all tables and types...'))

  const tables = await db.sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `
  for (const row of tables) {
    await db.sql.unsafe(`DROP TABLE IF EXISTS "${row.table_name}" CASCADE`)
  }

  // Drop all enum types in public schema
  const types = await db.sql`
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typtype = 'e'
  `
  for (const row of types) {
    await db.sql.unsafe(`DROP TYPE IF EXISTS "${row.typname}" CASCADE`)
  }

  // Delete existing migration files
  console.log(chalk.cyan('Clearing migration directory...'))
  rmSync(MIGRATIONS_PATH, { recursive: true, force: true })

  // Generate new migration
  console.log(chalk.cyan('Generating fresh migration...'))

  const desired = registry.buildRepresentation()
  const actual = await introspector.introspect()
  const diff = new SchemaDiffer().diff(desired, actual)

  const sql = new SqlGenerator().generate(diff)
  const version = Date.now().toString()
  const tableOrder = desired.tables.map(t => t.name)

  const fileGen = new MigrationFileGenerator(MIGRATIONS_PATH)
  await fileGen.generate(version, 'fresh', sql, diff, tableOrder)

  // Run the migration
  console.log(chalk.cyan('Running migration...'))

  const tracker = new MigrationTracker(db)
  const runner = new MigrationRunner(db, tracker, MIGRATIONS_PATH)
  const result = await runner.run()

  return result.applied.length
}

/**
 * Guard that ensures APP_ENV is "local". Exits the process if not.
 */
export function requireLocalEnv(commandName: string): void {
  const appEnv = process.env.APP_ENV
  if (appEnv !== 'local') {
    console.error(
      chalk.red('REJECTED: ') + `${commandName} can only run when APP_ENV is set to "local".`
    )
    if (!appEnv) {
      console.error(chalk.dim('  APP_ENV is not defined in .env'))
    } else {
      console.error(chalk.dim(`  Current APP_ENV: "${appEnv}"`))
    }
    process.exit(1)
  }
}

export function register(program: Command): void {
  program
    .command('fresh')
    .alias('migration:fresh')
    .description('Reset database and migrations, regenerate and run from scratch')
    .action(async () => {
      requireLocalEnv('fresh')

      // 6-digit challenge
      const challenge = String(Math.floor(100000 + Math.random() * 900000))
      console.log(
        chalk.red('WARNING: ') +
          'This will ' +
          chalk.red('destroy ALL data') +
          ' in the database and recreate everything from schemas.'
      )
      console.log(`\n  Type ${chalk.yellow(challenge)} to confirm:\n`)

      const answer = await prompt('  > ')
      if (answer.trim() !== challenge) {
        console.error(chalk.red('\nChallenge code does not match. Operation cancelled.'))
        process.exit(1)
      }

      let db
      try {
        const { db: database, registry, introspector } = await bootstrap()
        db = database

        const applied = await freshDatabase(db, registry, introspector)

        console.log(chalk.green(`\nFresh migration complete. Applied ${applied} migration(s).`))
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : err}`))
        process.exit(1)
      } finally {
        if (db) await shutdown(db)
      }
    })
}

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer)
    })
  })
}
