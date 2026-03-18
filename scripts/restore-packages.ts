import path from 'node:path';
import { readFile, rm, writeFile } from 'node:fs/promises';

const ROOT_DIR = path.resolve(import.meta.dir, '..');
const PACKAGE_NAMES = ['core', 'react', 'server', 'tooling'] as const;

function packageDir(packageName: (typeof PACKAGE_NAMES)[number]): string {
  return path.join(ROOT_DIR, 'packages', packageName);
}

async function restorePackage(packageName: (typeof PACKAGE_NAMES)[number]): Promise<void> {
  const directory = packageDir(packageName);
  const backupDirectory = path.join(directory, '.publish-backup');
  const backupPackageJson = path.join(backupDirectory, 'package.json');

  await rm(path.join(directory, 'dist'), { recursive: true, force: true });
  await rm(path.join(directory, 'tsconfig.build.json'), { force: true });

  if (await Bun.file(backupPackageJson).exists()) {
    await writeFile(path.join(directory, 'package.json'), await readFile(backupPackageJson));
    await rm(backupDirectory, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  console.log('🔄 Restoring Richie Router packages...');

  for (const packageName of PACKAGE_NAMES) {
    await restorePackage(packageName);
  }

  console.log('✨ Packages restored to development state.');
}

main().catch((error) => {
  console.error('Restore failed:', error);
  process.exit(1);
});
