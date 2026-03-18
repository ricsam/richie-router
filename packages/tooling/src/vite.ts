import { generateRouteTree, type GenerateRouteTreeOptions } from './index';

export function richieRouter(options: GenerateRouteTreeOptions) {
  return {
    name: 'richie-router',
    async buildStart() {
      await generateRouteTree(options);
    },
  };
}
