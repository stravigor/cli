import type { Command } from 'commander'
import chalk from 'chalk'
import { bootstrap, shutdown } from '../cli/bootstrap.ts'
import Queue from '@stravigor/queue/queue/queue'

export function register(program: Command): void {
  program
    .command('queue:flush')
    .description('Delete all jobs from a queue')
    .option('--queue <name>', 'Queue to flush', 'default')
    .option('--failed', 'Also flush failed jobs')
    .action(async options => {
      let db
      try {
        const { db: database, config } = await bootstrap()
        db = database

        new Queue(db, config)
        await Queue.ensureTables()

        const cleared = await Queue.clear(options.queue)
        console.log(chalk.green(`Cleared ${cleared} pending job(s) from "${options.queue}".`))

        if (options.failed) {
          const failedCleared = await Queue.clearFailed(options.queue)
          console.log(chalk.green(`Cleared ${failedCleared} failed job(s).`))
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : err}`))
        process.exit(1)
      } finally {
        if (db) await shutdown(db)
      }
    })
}
