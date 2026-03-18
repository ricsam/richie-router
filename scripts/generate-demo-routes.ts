import path from 'node:path';
import { generateRouteTree } from '@richie-router/tooling';

await generateRouteTree({
  routesDir: path.resolve('demo/frontend/routes'),
  headTagSchema: path.resolve('demo/shared/head-tag-schema.ts'),
  output: path.resolve('demo/shared/route-tree.gen.ts'),
  manifestOutput: path.resolve('demo/shared/route-manifest.gen.ts'),
});
