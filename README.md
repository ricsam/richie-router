# Richie Router

A Bun + TypeScript workspace implementing a file-based, type-safe React router with:

- `@richie-router/core`
- `@richie-router/react`
- `@richie-router/server`
- `@richie-router/tooling`
- `demo/` to exercise the router end to end

## Scripts

```bash
bun install
bun run demo:generate
bun run demo:build-client
bun run demo:start
bun run typecheck
bun test
```

`bun test` runs the route generator, builds the demo client bundle, exercises the demo server, and then runs the TypeScript type-safety checks.

## Demo

The demo app lives in `demo/` and uses generated file routes, a shared head tag schema, a server-safe route manifest, client rendering, server head tag resolution, and type-checked navigation helpers.
