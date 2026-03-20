import path from 'node:path';
import { generateRouteTree } from '@richie-router/tooling';

await generateRouteTree({
  routesDir: path.resolve('docs/frontend/routes'),
  routerSchema: path.resolve('docs/shared/router-schema.ts'),
  output: path.resolve('docs/frontend/route-tree.gen.ts'),
  manifestOutput: path.resolve('docs/shared/route-manifest.gen.ts'),
  jsonOutput: path.resolve('docs/shared/spa-routes.gen.json'),
});
