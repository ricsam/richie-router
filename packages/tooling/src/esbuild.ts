import { generateRouteTree, type GenerateRouteTreeOptions } from './index';

export function richieRouterPlugin(options: GenerateRouteTreeOptions) {
  return {
    name: 'richie-router',
    setup(build: { onStart(callback: () => Promise<void> | void): void }) {
      build.onStart(async () => {
        await generateRouteTree(options);
      });
    },
  };
}
