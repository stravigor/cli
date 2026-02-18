import { join } from 'node:path'
import type { Command } from 'commander'
import chalk from 'chalk'
import SchemaRegistry from '@stravigor/database/schema/registry'
import ModelGenerator from '../generators/model_generator.ts'
import type { GeneratorConfig } from '../generators/config.ts'

export function register(program: Command): void {
  program
    .command('generate:models')
    .alias('g:models')
    .description('Generate model classes and enums from schema definitions')
    .action(async () => {
      try {
        console.log(chalk.cyan('Generating models from schemas...'))

        const registry = new SchemaRegistry()
        await registry.discover('database/schemas')
        registry.validate()

        const schemas = registry.resolve()
        const representation = registry.buildRepresentation()

        // Load generator config (if available)
        let config: GeneratorConfig | undefined
        try {
          config = (await import(join(process.cwd(), 'config/generators.ts'))).default
        } catch {
          // No config/generators.ts — use defaults
        }

        const generator = new ModelGenerator(schemas, representation, config)
        const files = await generator.writeAll()

        if (files.length === 0) {
          console.log(chalk.yellow('No models to generate.'))
          return
        }

        console.log(chalk.green(`\nGenerated ${files.length} file(s):`))
        for (const file of files) {
          console.log(chalk.dim(`  ${file.path}`))
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : err}`))
        process.exit(1)
      }
    })
}
