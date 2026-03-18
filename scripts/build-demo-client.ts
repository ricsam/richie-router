import path from 'node:path';

const result = await Bun.build({
  entrypoints: [path.resolve('demo/frontend/client.tsx')],
  outdir: path.resolve('demo/.dist'),
  naming: {
    entry: 'client.js',
  },
  minify: false,
  sourcemap: 'external',
  target: 'browser',
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }

  process.exitCode = 1;
}
