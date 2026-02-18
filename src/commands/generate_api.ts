import { join } from 'node:path'
import type { Command } from 'commander'
import chalk from 'chalk'
import SchemaRegistry from '@stravigor/database/schema/registry'
import ApiGenerator from '../generators/api_generator.ts'
import RouteGenerator from '../generators/route_generator.ts'
import TestGenerator from '../generators/test_generator.ts'
import DocGenerator from '../generators/doc_generator.ts'
import type { ApiRoutingConfig } from '../generators/route_generator.ts'
import type { GeneratorConfig } from '../generators/config.ts'

export function register(program: Command): void {
  program
    .command('generate:api')
    .alias('g:api')
    .description(
      'Generate services, controllers, policies, validators, events, and routes from schemas'
    )
    .action(async () => {
      try {
        console.log(chalk.cyan('Generating API layer from schemas...'))

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

        const apiGen = new ApiGenerator(schemas, representation, config)
        const apiFiles = await apiGen.writeAll()

        // Load API routing config from config/http.ts (if available)
        let apiConfig: Partial<ApiRoutingConfig> | undefined
        try {
          const httpConfig = (await import(join(process.cwd(), 'config/http.ts'))).default
          apiConfig = httpConfig.api
        } catch {
          // No config/http.ts or no api section — use defaults
        }

        const routeGen = new RouteGenerator(schemas, config, apiConfig)
        const routeFiles = await routeGen.writeAll()

        const testGen = new TestGenerator(schemas, representation, config, apiConfig)
        const testFiles = await testGen.writeAll()

        const docGen = new DocGenerator(schemas, representation, config, apiConfig)
        const docFiles = await docGen.writeAll()

        const files = [...apiFiles, ...routeFiles, ...testFiles, ...docFiles]

        if (files.length === 0) {
          console.log(chalk.yellow('No API files to generate.'))
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
