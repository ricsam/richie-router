import path from 'node:path';
import { generateRouteTree } from '@richie-router/tooling';

await generateRouteTree({
  routesDir: path.resolve('demo/frontend/routes'),
  routerSchema: path.resolve('demo/shared/router-schema.ts'),
  output: path.resolve('demo/frontend/route-tree.gen.ts'),
  manifestOutput: path.resolve('demo/shared/route-manifest.gen.ts'),
});
