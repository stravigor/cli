import type { Command } from 'commander'
import chalk from 'chalk'
import path from 'node:path'
import { bootstrap, shutdown } from '../cli/bootstrap.ts'
import Scheduler from '@stravigor/queue/scheduler/scheduler'
import SchedulerRunner from '@stravigor/queue/scheduler/runner'

export function register(program: Command): void {
  program
    .command('schedule')
    .alias('scheduler:work')
    .description('Start the task scheduler')
    .action(async () => {
      let db
      try {
        const { db: database } = await bootstrap()
        db = database

        // Load user's scheduled tasks
        const schedulesPath = path.resolve('app/schedules.ts')
        await import(schedulesPath)

        const taskCount = Scheduler.tasks.length
        if (taskCount === 0) {
          console.log(chalk.yellow('No tasks registered. Add tasks in app/schedules.ts'))
          return
        }

        console.log(chalk.cyan(`Scheduler starting with ${taskCount} task(s)...`))
        for (const task of Scheduler.tasks) {
          console.log(chalk.dim(`  ${task.name}`))
        }
        console.log(chalk.dim('  Press Ctrl+C to stop.\n'))

        const runner = new SchedulerRunner()
        await runner.start()

        console.log(chalk.dim('\nScheduler stopped.'))
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : err}`))
        process.exit(1)
      } finally {
        if (db) await shutdown(db)
      }
    })
}
