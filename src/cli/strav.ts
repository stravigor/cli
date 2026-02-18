import 'reflect-metadata'
import { Command } from 'commander'
import { join } from 'node:path'
import CommandLoader from './command_loader.ts'

const pkg = await Bun.file(join(import.meta.dir, '../../package.json')).json()
const program = new Command()

program.name('strav').description('Strav CLI').version(pkg.version)

await CommandLoader.discover(program)

program.parse()
