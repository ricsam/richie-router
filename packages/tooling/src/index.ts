import { readdir, writeFile } from 'node:fs/promises';
import { watch as fsWatch } from 'node:fs';
import path from 'node:path';

export interface GenerateRouteTreeOptions {
  routesDir: string;
  routerSchema: string;
  output: string;
  manifestOutput?: string;
  jsonOutput?: string;
  quoteStyle?: 'single' | 'double';
  semicolons?: boolean;
}

export interface RouteTreeWatcher {
  close(): void;
}

interface RouteFileRecord {
  absPath: string;
  relPath: string;
  importPath: string;
  importName: string;
  variableName: string;
  withChildrenName: string;
  id: string;
  to: string;
  isRoot: boolean;
  parentId: string | null;
}
type ScannedRouteFile = RouteFileRecord;

function quote(value: string, quoteStyle: 'single' | 'double'): string {
  const marker = quoteStyle === 'single' ? "'" : '"';
  const escaped = value.replaceAll('\\', '\\\\').replaceAll(marker, `\\${marker}`);
  return `${marker}${escaped}${marker}`;
}

async function walkDirectory(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDirectory(entryPath)));
      continue;
    }

    if (!/\.(ts|tsx|js|jsx)$/u.test(entry.name)) {
      continue;
    }

    files.push(entryPath);
  }

  return files;
}

function isIgnoredRouteFile(relativeFilePath: string): boolean {
  return relativeFilePath
    .split(path.sep)
    .some(segment => segment.startsWith('-') || segment === '__tests__');
}

interface SegmentInfo {
  raw: string;
  breaksNesting: boolean;
}

function createSegmentInfo(raw: string): SegmentInfo {
  return {
    raw,
    breaksNesting: raw.endsWith('_') && raw !== '_',
  };
}

function computeRoutePath(relativeFilePath: string): {
  id: string;
  to: string;
  isRoot: boolean;
  segments: SegmentInfo[];
  isIndex: boolean;
} | null {
  const withoutExtension = relativeFilePath.replace(/\.[^.]+$/u, '');

  if (withoutExtension === '__root') {
    return {
      id: '__root__',
      to: '/',
      isRoot: true,
      segments: [],
      isIndex: false,
    };
  }

  const rawParts = withoutExtension.split(path.sep);
  const logicalParts: string[] = [];

  for (let index = 0; index < rawParts.length; index += 1) {
    const part = rawParts[index];
    if (!part || /^\(.*\)$/u.test(part)) {
      continue;
    }

    if (index === rawParts.length - 1) {
      if (part === 'route') {
        continue;
      }

      logicalParts.push(...part.split('.'));
      continue;
    }

    logicalParts.push(part);
  }

  const isIndex = logicalParts.at(-1) === 'index';
  const segmentParts = isIndex ? logicalParts.slice(0, -1) : logicalParts;
  const segments = segmentParts.map(createSegmentInfo);

  const idPath = segments.map(segment => segment.raw).join('/');
  const id = idPath ? `/${idPath}${isIndex ? '/' : ''}` : '/';
  const to = normalizeToPath(segments, isIndex);

  return {
    id,
    to,
    isRoot: false,
    segments,
    isIndex,
  };
}

function normalizeToPath(segments: SegmentInfo[], isIndex: boolean): string {
  const publicSegments = segments
    .map(segment => {
      if (segment.raw.startsWith('_')) {
        return null;
      }

      if (segment.raw.endsWith('_')) {
        return segment.raw.slice(0, -1);
      }

      return segment.raw;
    })
    .filter((segment): segment is string => Boolean(segment));

  if (publicSegments.length === 0) {
    return '/';
  }

  if (isIndex) {
    return `/${publicSegments.join('/')}`;
  }

  return `/${publicSegments.join('/')}`;
}

function computeParentId(
  route: ReturnType<typeof computeRoutePath>,
  knownRouteIds: Set<string>,
): string | null {
  if (!route || route.isRoot) {
    return null;
  }

  let ancestry = route.isIndex ? [...route.segments] : route.segments.slice(0, -1);
  const breakIndex = ancestry.findIndex(segment => segment.breaksNesting);
  if (breakIndex >= 0) {
    ancestry = ancestry.slice(0, breakIndex);
  }

  for (let length = ancestry.length; length > 0; length -= 1) {
    const parentId = `/${ancestry.slice(0, length).map(segment => segment.raw).join('/')}`;
    if (knownRouteIds.has(parentId)) {
      return parentId;
    }
  }

  return '__root__';
}

function variableBaseName(relativeFilePath: string): string {
  return relativeFilePath
    .replace(/\.[^.]+$/u, '')
    .split(/[/.()-]/u)
    .filter(Boolean)
    .map(part => part.replace(/^\$/u, 'Splat').replace(/^\d+/u, match => `_${match}`))
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

async function scanRoutes(options: GenerateRouteTreeOptions): Promise<ScannedRouteFile[]> {
  const routesDir = path.resolve(options.routesDir);
  const files = (await walkDirectory(routesDir))
    .map(file => path.resolve(file))
    .filter(file => !isIgnoredRouteFile(path.relative(routesDir, file)))
    .sort();

  const provisional = files
    .map(file => {
      const relPath = path.relative(routesDir, file);
      const computed = computeRoutePath(relPath);
      if (!computed) {
        return null;
      }

      const variableName = `${variableBaseName(relPath)}Route`;
      return {
        absPath: file,
        relPath,
        importPath: '',
        importName: `${variableName}Import`,
        variableName,
        withChildrenName: `${variableName}WithChildren`,
        id: computed.id,
        to: computed.to,
        isRoot: computed.isRoot,
        parentId: null,
        segments: computed.segments,
        isIndex: computed.isIndex,
      };
    })
    .filter((route): route is NonNullable<typeof route> => route !== null);

  const knownRouteIds = new Set(provisional.map(route => route.id));
  const outputDirectory = path.dirname(path.resolve(options.output));

  const scanned = provisional.map(route => ({
    absPath: route.absPath,
    relPath: route.relPath,
    importPath: relativeImportPath(outputDirectory, route.absPath),
    importName: route.importName,
    variableName: route.variableName,
    withChildrenName: route.withChildrenName,
    id: route.id,
    to: route.to,
    isRoot: route.isRoot,
    parentId: computeParentId(
      {
        id: route.id,
        to: route.to,
        isRoot: route.isRoot,
        segments: route.segments,
        isIndex: route.isIndex,
      },
      knownRouteIds,
    ),
  }));

  return scanned.sort((left, right) => {
    if (left.isRoot) return -1;
    if (right.isRoot) return 1;
    return left.id.localeCompare(right.id);
  });
}

function relativeImportPath(fromDirectory: string, targetFile: string): string {
  const relativePath = path.relative(fromDirectory, targetFile).split(path.sep).join('/');
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

function formatStatement(statement: string, options: GenerateRouteTreeOptions): string {
  return `${statement}${options.semicolons === false ? '' : ';'}`;
}

function choosePublicRoute(existing: ScannedRouteFile | undefined, candidate: ScannedRouteFile): ScannedRouteFile {
  if (!existing) {
    return candidate;
  }

  if (candidate.id.endsWith('/')) {
    return candidate;
  }

  return existing;
}

function getManifestOutputPath(options: GenerateRouteTreeOptions): string | null {
  return options.manifestOutput ? path.resolve(options.manifestOutput) : null;
}

function getJsonOutputPath(options: GenerateRouteTreeOptions): string | null {
  return options.jsonOutput ? path.resolve(options.jsonOutput) : null;
}

function buildRouteCollections(routes: ScannedRouteFile[]) {
  const rootRoute = routes.find(route => route.isRoot);
  if (!rootRoute) {
    throw new Error('A __root.tsx route file is required.');
  }

  const nonRootRoutes = routes.filter(route => !route.isRoot);
  const routesById = new Map(routes.map(route => [route.id, route]));
  const childrenByParent = new Map<string, ScannedRouteFile[]>();

  for (const route of nonRootRoutes) {
    const parentId = route.parentId ?? '__root__';
    const bucket = childrenByParent.get(parentId) ?? [];
    bucket.push(route);
    childrenByParent.set(parentId, bucket);
  }

  const publicRouteMap = new Map<string, ScannedRouteFile>();
  for (const route of nonRootRoutes) {
    publicRouteMap.set(route.to, choosePublicRoute(publicRouteMap.get(route.to), route));
  }

  return {
    rootRoute,
    nonRootRoutes,
    routesById,
    childrenByParent,
    publicRouteMap,
  };
}

function isIndexRoute(route: ScannedRouteFile): boolean {
  return !route.isRoot && route.id.endsWith('/');
}

function isPathlessRoute(route: ScannedRouteFile, routesById: Map<string, ScannedRouteFile>): boolean {
  if (route.isRoot || isIndexRoute(route) || !route.parentId) {
    return false;
  }

  const parentRoute = routesById.get(route.parentId);
  if (!parentRoute) {
    return false;
  }

  return route.to === parentRoute.to;
}

function canTerminateRoute(
  route: ScannedRouteFile,
  routesById: Map<string, ScannedRouteFile>,
  childrenByParent: Map<string, ScannedRouteFile[]>,
): boolean {
  if (route.isRoot || isPathlessRoute(route, routesById)) {
    return false;
  }

  const children = childrenByParent.get(route.id) ?? [];
  if (children.length === 0) {
    return true;
  }

  return !children.some(child => isIndexRoute(child));
}

function collectRegisteredSpaRoutes(
  rootRoute: ScannedRouteFile,
  routesById: Map<string, ScannedRouteFile>,
  childrenByParent: Map<string, ScannedRouteFile[]>,
): string[] {
  const routes = new Set<string>();

  function walk(route: ScannedRouteFile): void {
    if (canTerminateRoute(route, routesById, childrenByParent)) {
      routes.add(route.to);
    }

    for (const child of childrenByParent.get(route.id) ?? []) {
      walk(child);
    }
  }

  walk(rootRoute);
  return [...routes].sort((left, right) => left.localeCompare(right));
}

function buildChildAssemblies(
  rootRoute: ScannedRouteFile,
  routesById: Map<string, ScannedRouteFile>,
  childrenByParent: Map<string, ScannedRouteFile[]>,
  options: GenerateRouteTreeOptions,
): string[] {
  return [...childrenByParent.entries()]
    .map(([parentId, children]) => {
      if (parentId === '__root__') {
        return '';
      }

      const parent = parentId === '__root__' ? rootRoute : routesById.get(parentId);
      if (!parent || children.length === 0) {
        return '';
      }

      const childObjectName = `${parent.variableName}Children`;
      const childMembers = children.map(child => {
        const treeName = childrenByParent.has(child.id) ? child.withChildrenName : child.variableName;
        return `  ${treeName},`;
      });
      const parentTreeName = parent.withChildrenName;

      return [
        formatStatement(`const ${childObjectName} = {\n${childMembers.join('\n')}\n}`, options),
        formatStatement(`const ${parentTreeName} = ${parent.variableName}._addFileChildren(${childObjectName})`, options),
      ].join('\n');
    })
    .filter(Boolean);
}

function buildRouteMetadataAccess(routeId: string, quoteStyle: 'single' | 'double'): string {
  return `._setSearchSchema((routerSchema as any)[${quote(routeId, quoteStyle)}]?.searchSchema as never)._setServerHead((routerSchema as any)[${quote(routeId, quoteStyle)}]?.serverHead)`;
}

function buildGeneratedClientFile(routes: ScannedRouteFile[], options: GenerateRouteTreeOptions): string {
  const quoteStyle = options.quoteStyle ?? 'single';
  const outputDirectory = path.dirname(path.resolve(options.output));
  const schemaImport = relativeImportPath(outputDirectory, path.resolve(options.routerSchema));
  const { rootRoute, nonRootRoutes, routesById, childrenByParent, publicRouteMap } = buildRouteCollections(routes);
  const allRoutes = [rootRoute, ...nonRootRoutes];

  const routeImports = routes.map(route =>
    formatStatement(
      `import { Route as ${route.importName} } from ${quote(route.importPath, quoteStyle)}`,
      options,
    ),
  );

  const routeUpdates = nonRootRoutes.map(route => {
    const parentReference =
      route.parentId === '__root__'
        ? rootRoute.variableName
        : routesById.get(route.parentId ?? '')?.variableName ?? rootRoute.variableName;

    return formatStatement(
      `const ${route.variableName} = ${route.importName}.update({ id: ${quote(route.id, quoteStyle)}, path: ${quote(route.id, quoteStyle)}, getParentRoute: () => ${parentReference} } as const)${buildRouteMetadataAccess(route.id, quoteStyle)}`,
      options,
    );
  });

  const routeSearchEntries = allRoutes.map(
    route =>
      `  ${quote(route.id, quoteStyle)}: InferRouterSearchSchema<RouterSchema, ${quote(route.id, quoteStyle)}>${options.semicolons === false ? '' : ';'}`,
  );

  const fileRoutesByIdEntries = [
    `  ${quote('__root__', quoteStyle)}: typeof ${rootRoute.variableName}${options.semicolons === false ? '' : ';'}`,
    ...nonRootRoutes.map(route => {
      const treeName = childrenByParent.has(route.id) ? route.withChildrenName : route.variableName;
      return `  ${quote(route.id, quoteStyle)}: typeof ${treeName}${options.semicolons === false ? '' : ';'}`;
    }),
  ];

  const fileRoutesByFullPathEntries = nonRootRoutes.map(route => {
    const treeName = childrenByParent.has(route.id) ? route.withChildrenName : route.variableName;
    return `  ${quote(route.id, quoteStyle)}: typeof ${treeName}${options.semicolons === false ? '' : ';'}`;
  });

  const fileRoutesByToEntries = [...publicRouteMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([to, route]) => {
      const treeName = childrenByParent.has(route.id) ? route.withChildrenName : route.variableName;
      return `  ${quote(to, quoteStyle)}: typeof ${treeName}${options.semicolons === false ? '' : ';'}`;
    });

  const ids = ['__root__', ...nonRootRoutes.map(route => route.id)];
  const fullPaths = [...new Set(nonRootRoutes.map(route => route.to))];
  const toPaths = [...publicRouteMap.keys()];
  const childAssemblies = buildChildAssemblies(rootRoute, routesById, childrenByParent, options);
  const fileRouteIdsUnion = ids.map(value => quote(value, quoteStyle)).join(' | ');

  const rootChildrenName = `${rootRoute.variableName}Children`;
  const rootChildren = (childrenByParent.get('__root__') ?? []).map(child => {
    const treeName = childrenByParent.has(child.id) ? child.withChildrenName : child.variableName;
    return `  ${treeName},`;
  });

  const idAssertions = allRoutes.map(route =>
    `type ${route.variableName}IdAssertion = Assert<IsEqual<typeof ${route.importName}['id'], ${quote(route.id, quoteStyle)}>>`,
  );
  const serverHeadAssertions = allRoutes.map(route =>
    `type ${route.variableName}ServerHeadAssertion = Assert<RouteUsesServerHead<RouterSchema, ${quote(route.id, quoteStyle)}> extends true ? HasInlineHead<typeof ${route.importName}> extends true ? false : true : true>`,
  );

  return [
    '/* eslint-disable */',
    formatStatement(`import { routerSchema } from ${quote(schemaImport, quoteStyle)}`, options),
    formatStatement(`import type { RouterSchema } from ${quote(schemaImport, quoteStyle)}`, options),
    formatStatement(`import type { InferRouterSearchSchema, RouteUsesServerHead } from '@richie-router/core'`, options),
    '',
    ...routeImports,
    '',
    formatStatement(
      `const ${rootRoute.variableName} = ${rootRoute.importName}${buildRouteMetadataAccess(rootRoute.id, quoteStyle)}`,
      options,
    ),
    '',
    'type Assert<T extends true> = T',
    'type IsEqual<TLeft, TRight> = (<TValue>() => TValue extends TLeft ? 1 : 2) extends (<TValue>() => TValue extends TRight ? 1 : 2) ? true : false',
    'type HasInlineHead<TRoute> = TRoute extends { __hasInlineHead: infer TValue } ? TValue : false',
    `type FileRouteIds = ${fileRouteIdsUnion}`,
    'type RouterSchemaKeyAssertion = Assert<Exclude<keyof RouterSchema, FileRouteIds> extends never ? true : false>',
    ...idAssertions,
    ...serverHeadAssertions,
    '',
    ...routeUpdates,
    '',
    'export interface RouteSearchSchema {',
    ...routeSearchEntries,
    '}',
    '',
    'export interface FileRoutesById {',
    ...fileRoutesByIdEntries,
    '}',
    '',
    'export interface FileRoutesByFullPath {',
    ...fileRoutesByFullPathEntries,
    '}',
    '',
    'export interface FileRoutesByTo {',
    ...fileRoutesByToEntries,
    '}',
    '',
    'export interface FileRouteTypes {',
    `  fullPaths: ${fullPaths.map(value => quote(value, quoteStyle)).join(' | ') || 'never'}${options.semicolons === false ? '' : ';'}`,
    `  to: ${toPaths.map(value => quote(value, quoteStyle)).join(' | ') || 'never'}${options.semicolons === false ? '' : ';'}`,
    `  id: ${ids.map(value => quote(value, quoteStyle)).join(' | ')}${options.semicolons === false ? '' : ';'}`,
    `  fileRoutesById: FileRoutesById${options.semicolons === false ? '' : ';'}`,
    `  fileRoutesByTo: FileRoutesByTo${options.semicolons === false ? '' : ';'}`,
    `  fileRoutesByFullPath: FileRoutesByFullPath${options.semicolons === false ? '' : ';'}`,
    '}',
    '',
    "declare module '@richie-router/react' {",
    '  interface Register {',
    `    routeTree: typeof routeTree${options.semicolons === false ? '' : ';'}`,
    `    routeSearchSchema: RouteSearchSchema${options.semicolons === false ? '' : ';'}`,
    '  }',
    '}',
    '',
    ...childAssemblies,
    '',
    formatStatement(`const ${rootChildrenName} = {\n${rootChildren.join('\n')}\n}`, options),
    formatStatement(
      `export const routeTree = ${rootRoute.variableName}._addFileChildren(${rootChildrenName})._addFileTypes<FileRouteTypes>()`,
      options,
    ),
    '',
  ].join('\n');
}

function buildGeneratedManifestFile(routes: ScannedRouteFile[], options: GenerateRouteTreeOptions): string {
  const manifestOutput = getManifestOutputPath(options);
  if (!manifestOutput) {
    return '';
  }

  const quoteStyle = options.quoteStyle ?? 'single';
  const outputDirectory = path.dirname(manifestOutput);
  const schemaImport = relativeImportPath(outputDirectory, path.resolve(options.routerSchema));
  const { rootRoute, nonRootRoutes, routesById, childrenByParent } = buildRouteCollections(routes);

  const routeDeclarations = [
    formatStatement(
      `const ${rootRoute.variableName} = createRouteNode('__root__', {}, { isRoot: true })${buildRouteMetadataAccess(rootRoute.id, quoteStyle)}`,
      options,
    ),
    ...nonRootRoutes.map(route => {
      const parentReference =
        route.parentId === '__root__'
          ? rootRoute.variableName
          : routesById.get(route.parentId ?? '')?.variableName ?? rootRoute.variableName;
      return formatStatement(
        `const ${route.variableName} = createRouteNode(${quote(route.id, quoteStyle)}, {}).update({ id: ${quote(route.id, quoteStyle)}, path: ${quote(route.id, quoteStyle)}, getParentRoute: () => ${parentReference} } as const)${buildRouteMetadataAccess(route.id, quoteStyle)}`,
        options,
      );
    }),
  ];

  const childAssemblies = buildChildAssemblies(rootRoute, routesById, childrenByParent, options);
  const rootChildrenName = `${rootRoute.variableName}Children`;
  const rootChildren = (childrenByParent.get('__root__') ?? []).map(child => {
    const treeName = childrenByParent.has(child.id) ? child.withChildrenName : child.variableName;
    return `  ${treeName},`;
  });

  return [
    '/* eslint-disable */',
    formatStatement(`import { createRouteNode } from '@richie-router/core'`, options),
    formatStatement(`import { routerSchema } from ${quote(schemaImport, quoteStyle)}`, options),
    '',
    ...routeDeclarations,
    '',
    ...childAssemblies,
    '',
    formatStatement(`const ${rootChildrenName} = {\n${rootChildren.join('\n')}\n}`, options),
    formatStatement(
      `export const routeManifest = ${rootRoute.variableName}._addFileChildren(${rootChildrenName})`,
      options,
    ),
    '',
  ].join('\n');
}

function buildGeneratedRoutesJson(routes: ScannedRouteFile[]): string {
  const { rootRoute, nonRootRoutes, routesById, childrenByParent } = buildRouteCollections(routes);
  const allRoutes = [rootRoute, ...nonRootRoutes];
  const spaRoutes = collectRegisteredSpaRoutes(rootRoute, routesById, childrenByParent);

  return `${JSON.stringify(
    {
      routes: allRoutes.map(route => ({
        id: route.id,
        to: route.to,
        parentId: route.parentId,
        isRoot: route.isRoot,
      })),
      spaRoutes,
    },
    null,
    2,
  )}\n`;
}

export async function generateRouteTree(options: GenerateRouteTreeOptions): Promise<void> {
  const routes = await scanRoutes(options);
  const generatedClient = buildGeneratedClientFile(routes, options);
  await writeFile(path.resolve(options.output), generatedClient, 'utf8');

  const manifestOutput = getManifestOutputPath(options);
  if (manifestOutput) {
    const generatedManifest = buildGeneratedManifestFile(routes, options);
    await writeFile(manifestOutput, generatedManifest, 'utf8');
  }

  const jsonOutput = getJsonOutputPath(options);
  if (jsonOutput) {
    const generatedJson = buildGeneratedRoutesJson(routes);
    await writeFile(jsonOutput, generatedJson, 'utf8');
  }
}

export async function watchRouteTree(options: GenerateRouteTreeOptions): Promise<RouteTreeWatcher> {
  await generateRouteTree(options);

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const trigger = () => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      void generateRouteTree(options);
    }, 25);
  };

  const watchers = [
    fsWatch(path.resolve(options.routesDir), { recursive: true }, trigger),
    fsWatch(path.resolve(options.routerSchema), trigger),
  ];

  return {
    close() {
      if (timeout) {
        clearTimeout(timeout);
      }

      for (const watcher of watchers) {
        watcher.close();
      }
    },
  };
}
