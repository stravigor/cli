import type { Command } from 'commander'
import chalk from 'chalk'
import { bootstrap, shutdown } from '../cli/bootstrap.ts'
import Queue from '@stravigor/queue/queue/queue'
import Worker from '@stravigor/queue/queue/worker'

export function register(program: Command): void {
  program
    .command('queue:work')
    .description('Start processing queued jobs')
    .option('--queue <name>', 'Queue to process', 'default')
    .option('--sleep <ms>', 'Poll interval in milliseconds', '1000')
    .action(async options => {
      let db
      try {
        const { db: database, config } = await bootstrap()
        db = database

        new Queue(db, config)
        await Queue.ensureTables()

        const queue = options.queue
        const sleep = parseInt(options.sleep)

        console.log(chalk.cyan(`Worker starting on queue "${queue}"...`))
        console.log(chalk.dim(`  poll interval: ${sleep}ms`))
        console.log(chalk.dim('  Press Ctrl+C to stop.\n'))

        const worker = new Worker({ queue, sleep })
        await worker.start()

        console.log(chalk.dim('\nWorker stopped.'))
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : err}`))
        process.exit(1)
      } finally {
        if (db) await shutdown(db)
      }
    })
}
