import type { Command } from 'commander'
import chalk from 'chalk'
import { bootstrap, shutdown } from '../cli/bootstrap.ts'
import Queue from '@stravigor/queue/queue/queue'

export function register(program: Command): void {
  program
    .command('queue:retry')
    .description('Retry failed jobs by moving them back to the queue')
    .option('--queue <name>', 'Only retry jobs from this queue')
    .action(async options => {
      let db
      try {
        const { db: database, config } = await bootstrap()
        db = database

        new Queue(db, config)
        await Queue.ensureTables()

        const count = await Queue.retryFailed(options.queue)

        if (count === 0) {
          console.log(chalk.green('No failed jobs to retry.'))
        } else {
          console.log(chalk.green(`Moved ${count} failed job(s) back to the queue.`))
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : err}`))
        process.exit(1)
      } finally {
        if (db) await shutdown(db)
      }
    })
}
