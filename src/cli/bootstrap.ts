import Configuration from '@stravigor/kernel/config/configuration'
import Database from '@stravigor/database/database/database'
import SchemaRegistry from '@stravigor/database/schema/registry'
import DatabaseIntrospector from '@stravigor/database/database/introspector'
import Application from '@stravigor/kernel/core/application'
import type ServiceProvider from '@stravigor/kernel/core/service_provider'

export interface BootstrapResult {
  config: Configuration
  db: Database
  registry: SchemaRegistry
  introspector: DatabaseIntrospector
}

/**
 * Bootstrap the core framework services needed by CLI commands.
 *
 * Loads configuration, connects to the database, discovers and validates
 * schemas, and creates an introspector instance.
 */
export async function bootstrap(): Promise<BootstrapResult> {
  const config = new Configuration('./config')
  await config.load()

  const db = new Database(config)

  const registry = new SchemaRegistry()
  await registry.discover('database/schemas')
  registry.validate()

  const introspector = new DatabaseIntrospector(db)

  return { config, db, registry, introspector }
}

/** Cleanly close the database connection. */
export async function shutdown(db: Database): Promise<void> {
  await db.close()
}

/**
 * Bootstrap an Application with the given service providers.
 *
 * Creates a fresh Application, registers all providers, boots them
 * in dependency order, and returns the running application.
 * Signal handlers for graceful shutdown are installed automatically.
 *
 * @example
 * const app = await withProviders([
 *   new ConfigProvider(),
 *   new DatabaseProvider(),
 *   new AuthProvider({ resolver: (id) => User.find(id) }),
 * ])
 */
export async function withProviders(providers: ServiceProvider[]): Promise<Application> {
  const app = new Application()
  for (const provider of providers) app.use(provider)
  await app.start()
  return app
}
