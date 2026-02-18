# @stravigor/cli

CLI framework and code generators for the Strav framework. Provides the `strav` binary.

## Dependencies
- @stravigor/kernel (peer)
- @stravigor/http (peer)
- @stravigor/database (peer)
- @stravigor/queue (peer)
- @stravigor/signal (peer)

## Commands
- bun test
- bun run typecheck

## Architecture
- src/cli/ — CLI bootstrap, command loader, strav.ts entry point
- src/commands/ — Built-in commands (migrations, queue, scheduler, generators, db seed)
- src/generators/ — Code generators (model, route, API, test, doc)

## Conventions
- Commands are auto-loaded by command_loader.ts
- Generators output code that imports from the split packages (@stravigor/kernel, @stravigor/http, etc.)
- The `strav` binary is declared in package.json bin field
