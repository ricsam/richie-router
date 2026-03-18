import path from 'node:path';
import { generateRouteTree } from '@richie-router/tooling';

await generateRouteTree({
  routesDir: path.resolve('docs/frontend/routes'),
  headTagSchema: path.resolve('docs/shared/head-tag-schema.ts'),
  output: path.resolve('docs/shared/route-tree.gen.ts'),
  manifestOutput: path.resolve('docs/shared/route-manifest.gen.ts'),
});
