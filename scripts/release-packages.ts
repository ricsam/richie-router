import { $ } from 'bun';

const environment = {
  ...process.env,
  NPM_CONFIG_PROVENANCE: process.env.NPM_CONFIG_PROVENANCE ?? 'true',
};

async function runCommand(command: ReturnType<typeof $>): Promise<void> {
  const result = await command.nothrow();
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString() || result.stdout.toString());
  }
}

async function main(): Promise<void> {
  try {
    await runCommand($`bun run build:packages`.env(environment));
    await runCommand($`bunx changeset publish`.env(environment));
  } finally {
    const restoreResult = await $`bun run restore:packages`.env(environment).nothrow();
    if (restoreResult.exitCode !== 0) {
      const message = restoreResult.stderr.toString() || restoreResult.stdout.toString();
      throw new Error(message || 'Failed to restore packages after publish.');
    }
  }
}

main().catch((error) => {
  console.error('Release failed:', error);
  process.exit(1);
});
