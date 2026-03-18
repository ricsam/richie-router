import path from 'node:path';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';

const ROOT_DIR = path.resolve(import.meta.dir, '..');
const PACKAGES_DIR = path.join(ROOT_DIR, 'packages');
const PACKAGE_NAMES = ['core', 'react', 'server', 'tooling'] as const;

interface RepositoryMetadata {
  type?: string;
  url?: string;
  directory?: string;
}

interface RootMetadata {
  author?: string;
  bugs?: { url?: string };
  description?: string;
  homepage?: string;
  keywords?: string[];
  license?: string;
  repository?: RepositoryMetadata | string;
}

type PackageName = (typeof PACKAGE_NAMES)[number];

type StringRecord = Record<string, string>;

const PACKAGE_DESCRIPTIONS: Record<PackageName, string> = {
  core: 'Shared route, search, and head utilities for Richie Router',
  react: 'React runtime, components, and hooks for Richie Router',
  server: 'Server helpers for Richie Router head tags and document handling',
  tooling: 'Route generation and build-tool integrations for Richie Router',
};

function packageDir(packageName: PackageName): string {
  return path.join(PACKAGES_DIR, packageName);
}

function backupDir(packageName: PackageName): string {
  return path.join(packageDir(packageName), '.publish-backup');
}

function packageJsonPath(packageName: PackageName): string {
  return path.join(packageDir(packageName), 'package.json');
}

function backupPackageJsonPath(packageName: PackageName): string {
  return path.join(backupDir(packageName), 'package.json');
}

async function readJson<TValue>(filePath: string): Promise<TValue> {
  return (await Bun.file(filePath).json()) as TValue;
}

async function ensureBackup(packageName: PackageName): Promise<void> {
  const backupPath = backupPackageJsonPath(packageName);
  if (await Bun.file(backupPath).exists()) {
    return;
  }

  await mkdir(backupDir(packageName), { recursive: true });
  await Bun.write(backupPath, await Bun.file(packageJsonPath(packageName)).text());
}

async function readSourcePackageJson(packageName: PackageName): Promise<Record<string, any>> {
  const backupPath = backupPackageJsonPath(packageName);
  if (await Bun.file(backupPath).exists()) {
    return await readJson<Record<string, any>>(backupPath);
  }

  return await readJson<Record<string, any>>(packageJsonPath(packageName));
}

async function walkSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkSourceFiles(absolutePath)));
      continue;
    }

    if (!/\.(ts|tsx)$/u.test(entry.name) || entry.name.endsWith('.d.ts')) {
      continue;
    }

    files.push(absolutePath);
  }

  return files.sort();
}

function replaceRelativeExtensions(source: string, extension: 'cjs' | 'mjs'): string {
  const suffix = `.${extension}`;

  return source
    .replace(/(?<=\bfrom\s*['"])(\.{1,2}\/[^'"]+?)(?=['"])/gu, (specifier) =>
      specifier.replace(/\.(tsx?|jsx?|mjs|cjs)$/u, '') + suffix,
    )
    .replace(/(?<=\bimport\s*\(\s*['"])(\.{1,2}\/[^'"]+?)(?=['"]\s*\))/gu, (specifier) =>
      specifier.replace(/\.(tsx?|jsx?|mjs|cjs)$/u, '') + suffix,
    );
}

async function buildSourceFile(
  packageName: PackageName,
  sourceFile: string,
  format: 'esm' | 'cjs',
): Promise<void> {
  const directory = packageDir(packageName);
  const sourceRoot = path.join(directory, 'src');
  const relativeFile = path.relative(sourceRoot, sourceFile);
  const relativeDir = path.dirname(relativeFile);
  const outputDir =
    relativeDir === '.'
      ? path.join(directory, 'dist', format === 'esm' ? 'esm' : 'cjs')
      : path.join(directory, 'dist', format === 'esm' ? 'esm' : 'cjs', relativeDir);
  const extension = format === 'esm' ? 'mjs' : 'cjs';

  const result = await Bun.build({
    entrypoints: [sourceFile],
    outdir: outputDir,
    format,
    packages: 'external',
    external: ['*'],
    target: 'node',
    naming: `[name].${extension}`,
    plugins: [
      {
        name: 'rewrite-relative-import-extensions',
        setup(build) {
          build.onLoad({ filter: /\.[jt]sx?$/u }, async (args) => {
            const contents = await Bun.file(args.path).text();
            return {
              contents: replaceRelativeExtensions(contents, extension),
              loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts',
            };
          });
        },
      },
    ],
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(`[${log.level}] ${log.message}`);
    }

    throw new Error(`Failed to build ${path.relative(directory, sourceFile)} (${format})`);
  }
}

async function buildJavaScript(packageName: PackageName): Promise<void> {
  const sourceRoot = path.join(packageDir(packageName), 'src');
  const sourceFiles = await walkSourceFiles(sourceRoot);

  await Promise.all(
    sourceFiles.flatMap((sourceFile) => [
      buildSourceFile(packageName, sourceFile, 'esm'),
      buildSourceFile(packageName, sourceFile, 'cjs'),
    ]),
  );
}

async function writeTypeConfig(packageName: PackageName): Promise<void> {
  const directory = packageDir(packageName);

  await writeFile(
    path.join(directory, 'tsconfig.build.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          jsx: 'react-jsx',
          declaration: true,
          emitDeclarationOnly: true,
          declarationMap: false,
          outDir: 'dist/types',
          rootDir: 'src',
          stripInternal: false,
          skipLibCheck: true,
          strict: true,
          lib: ['ESNext', 'DOM'],
        },
        include: ['src/**/*.ts', 'src/**/*.tsx'],
        exclude: ['dist', 'node_modules', '**/*.test.ts', '**/*.test.tsx'],
      },
      null,
      2,
    ),
  );
}

async function buildTypes(packageName: PackageName): Promise<void> {
  await writeTypeConfig(packageName);

  const directory = packageDir(packageName);
  const result = await Bun.$`bunx --bun tsc -p tsconfig.build.json`.cwd(directory).nothrow();

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString() || result.stdout.toString());
  }
}

function toDistStem(sourcePath: string): string {
  return sourcePath.replace(/^\.\/src\//u, '').replace(/\.(tsx?|jsx?)$/u, '');
}

function normalizeWorkspaceVersion(version: string, packageVersion: string): string {
  const workspaceSpecifier = version.slice('workspace:'.length);

  if (workspaceSpecifier === '*' || workspaceSpecifier === '^') {
    return `^${packageVersion}`;
  }

  if (workspaceSpecifier === '~') {
    return `~${packageVersion}`;
  }

  return workspaceSpecifier || packageVersion;
}

function normalizeVersionRanges(
  values: unknown,
  packageVersions: Map<string, string>,
): StringRecord | undefined {
  if (!values || typeof values !== 'object') {
    return undefined;
  }

  const normalized: StringRecord = {};
  for (const [dependencyName, dependencyVersion] of Object.entries(values as Record<string, unknown>)) {
    if (typeof dependencyVersion !== 'string') {
      continue;
    }

    if (!dependencyVersion.startsWith('workspace:')) {
      normalized[dependencyName] = dependencyVersion;
      continue;
    }

    const resolvedVersion = packageVersions.get(dependencyName);
    if (!resolvedVersion) {
      throw new Error(`Unable to resolve workspace dependency version for ${dependencyName}`);
    }

    normalized[dependencyName] = normalizeWorkspaceVersion(dependencyVersion, resolvedVersion);
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeRepository(
  repository: RootMetadata['repository'],
  packageName: PackageName,
): RepositoryMetadata | string | undefined {
  if (!repository) {
    return undefined;
  }

  if (typeof repository === 'string') {
    return repository;
  }

  return {
    ...repository,
    directory: `packages/${packageName}`,
  };
}

function collectExportEntries(exportsField: unknown): Record<string, string> {
  if (typeof exportsField === 'string') {
    return { '.': exportsField };
  }

  if (!exportsField || typeof exportsField !== 'object') {
    throw new Error('Package exports must be a string or an object map of subpaths to source files.');
  }

  const collected = Object.entries(exportsField as Record<string, unknown>).reduce<Record<string, string>>(
    (result, [subpath, target]) => {
      if (typeof target !== 'string') {
        throw new Error(`Unsupported export target for "${subpath}".`);
      }

      result[subpath] = target;
      return result;
    },
    {},
  );

  if (!collected['.']) {
    throw new Error('Each publishable package must export ".".');
  }

  return collected;
}

function createPublishExports(exportsField: unknown): Record<string, string | Record<string, string>> {
  const entries = collectExportEntries(exportsField);

  return Object.entries(entries).reduce<Record<string, string | Record<string, string>>>(
    (result, [subpath, sourcePath]) => {
      const distStem = toDistStem(sourcePath);
      result[subpath] = {
        types: `./dist/types/${distStem}.d.ts`,
        import: `./dist/esm/${distStem}.mjs`,
        require: `./dist/cjs/${distStem}.cjs`,
        default: `./dist/esm/${distStem}.mjs`,
      };
      return result;
    },
    {
      './package.json': './package.json',
    },
  );
}

async function writeFormatPackageJsons(packageName: PackageName): Promise<void> {
  const directory = packageDir(packageName);

  await mkdir(path.join(directory, 'dist', 'cjs'), { recursive: true });
  await mkdir(path.join(directory, 'dist', 'esm'), { recursive: true });

  await Bun.write(
    path.join(directory, 'dist', 'cjs', 'package.json'),
    JSON.stringify(
      {
        type: 'commonjs',
      },
      null,
      2,
    ),
  );

  await Bun.write(
    path.join(directory, 'dist', 'esm', 'package.json'),
    JSON.stringify(
      {
        type: 'module',
      },
      null,
      2,
    ),
  );
}

async function writePublishPackageJson(
  packageName: PackageName,
  rootMetadata: RootMetadata,
  packageVersions: Map<string, string>,
): Promise<void> {
  const sourcePackageJson = await readSourcePackageJson(packageName);
  const publishPackageJson = { ...sourcePackageJson };
  const exportEntries = collectExportEntries(sourcePackageJson.exports);
  const publishExports = createPublishExports(sourcePackageJson.exports);
  const rootEntry = exportEntries['.'];
  if (!rootEntry) {
    throw new Error(`Missing root export for ${sourcePackageJson.name}`);
  }
  const rootDistStem = toDistStem(rootEntry);

  delete publishPackageJson.private;
  delete publishPackageJson.type;

  publishPackageJson.description ||= PACKAGE_DESCRIPTIONS[packageName] || rootMetadata.description;

  if (rootMetadata.author) {
    publishPackageJson.author = rootMetadata.author;
  }

  if (rootMetadata.license) {
    publishPackageJson.license = rootMetadata.license;
  }

  if (rootMetadata.homepage) {
    publishPackageJson.homepage = rootMetadata.homepage;
  }

  if (rootMetadata.bugs) {
    publishPackageJson.bugs = rootMetadata.bugs;
  }

  if (rootMetadata.keywords?.length) {
    publishPackageJson.keywords = rootMetadata.keywords;
  }

  const repository = normalizeRepository(rootMetadata.repository, packageName);
  if (repository) {
    publishPackageJson.repository = repository;
  }

  publishPackageJson.dependencies = normalizeVersionRanges(
    publishPackageJson.dependencies,
    packageVersions,
  );
  publishPackageJson.peerDependencies = normalizeVersionRanges(
    publishPackageJson.peerDependencies,
    packageVersions,
  );

  if (!publishPackageJson.dependencies) {
    delete publishPackageJson.dependencies;
  }

  if (!publishPackageJson.peerDependencies) {
    delete publishPackageJson.peerDependencies;
  }

  publishPackageJson.main = `./dist/cjs/${rootDistStem}.cjs`;
  publishPackageJson.module = `./dist/esm/${rootDistStem}.mjs`;
  publishPackageJson.types = `./dist/types/${rootDistStem}.d.ts`;
  publishPackageJson.exports = publishExports;
  publishPackageJson.files = ['dist'];
  publishPackageJson.publishConfig = {
    ...(typeof publishPackageJson.publishConfig === 'object' && publishPackageJson.publishConfig
      ? publishPackageJson.publishConfig
      : {}),
    access: 'public',
    provenance: true,
  };

  await Bun.write(packageJsonPath(packageName), JSON.stringify(publishPackageJson, null, 2));
}

async function buildPackage(
  packageName: PackageName,
  rootMetadata: RootMetadata,
  packageVersions: Map<string, string>,
): Promise<void> {
  const directory = packageDir(packageName);
  const sourcePackageJson = await readSourcePackageJson(packageName);

  console.log(`\n📦 Building ${sourcePackageJson.name}@${sourcePackageJson.version}...`);

  await ensureBackup(packageName);
  await rm(path.join(directory, 'dist'), { recursive: true, force: true });

  await Promise.all([buildJavaScript(packageName), buildTypes(packageName)]);
  await writeFormatPackageJsons(packageName);
  await writePublishPackageJson(packageName, rootMetadata, packageVersions);

  console.log(`✅ Prepared ${sourcePackageJson.name} for npm publishing`);
}

async function main(): Promise<void> {
  console.log('🚀 Building Richie Router packages for npm publishing...');

  const rootPackageJson = await readJson<Record<string, any>>(path.join(ROOT_DIR, 'package.json'));
  const rootMetadata: RootMetadata = {
    author: rootPackageJson.author,
    bugs: rootPackageJson.bugs,
    description: rootPackageJson.description,
    homepage: rootPackageJson.homepage,
    keywords: rootPackageJson.keywords,
    license: rootPackageJson.license,
    repository: rootPackageJson.repository,
  };

  const packageVersions = new Map<string, string>();
  for (const packageName of PACKAGE_NAMES) {
    const sourcePackageJson = await readSourcePackageJson(packageName);
    packageVersions.set(sourcePackageJson.name, sourcePackageJson.version);
  }

  for (const packageName of PACKAGE_NAMES) {
    await buildPackage(packageName, rootMetadata, packageVersions);
  }

  console.log('\n✨ All publishable packages are ready.');
}

main().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
