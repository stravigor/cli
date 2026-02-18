import { join } from 'node:path'
import { existsSync } from 'node:fs'
import type { Command } from 'commander'
import chalk from 'chalk'
import { toSnakeCase } from '@stravigor/kernel/helpers/strings'
import { formatAndWrite } from '../generators/config.ts'

const SEEDERS_PATH = 'database/seeders'

export function register(program: Command): void {
  program
    .command('generate:seeder <name>')
    .alias('g:seeder')
    .description('Generate a database seeder class')
    .option('-f, --force', 'Overwrite existing file')
    .action(async (name: string, { force }: { force?: boolean }) => {
      try {
        // Normalize: "UserSeeder" | "User" → class UserSeeder, file user_seeder.ts
        const className = name.endsWith('Seeder') ? name : `${name}Seeder`
        const baseName = className.replace(/Seeder$/, '') || 'Database'
        const fileName = toSnakeCase(baseName) + '_seeder'
        const filePath = join(SEEDERS_PATH, `${fileName}.ts`)

        if (existsSync(filePath) && !force) {
          console.log(chalk.yellow(`File already exists: `) + chalk.dim(filePath))
          console.log(chalk.dim('  Use --force to overwrite.'))
          return
        }

        const isDatabaseSeeder = baseName === 'Database'

        const content = isDatabaseSeeder
          ? generateDatabaseSeeder(className)
          : generateSeeder(className)

        await formatAndWrite([{ path: filePath, content }])

        console.log(chalk.green(`Created: `) + chalk.dim(filePath))
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : err}`))
        process.exit(1)
      }
    })
}

function generateDatabaseSeeder(className: string): string {
  return `import { Seeder } from '@stravigor/database/database'

export default class ${className} extends Seeder {
  async run(): Promise<void> {
    // Call sub-seeders:
    // await this.call(UserSeeder)
  }
}
`
}

function generateSeeder(className: string): string {
  return `import { Seeder } from '@stravigor/database/database'

export default class ${className} extends Seeder {
  async run(): Promise<void> {
    // Use factories or direct inserts to seed data:
    // await UserFactory.createMany(10)
  }
}
`
}
