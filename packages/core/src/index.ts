export type AnyComponent = (props?: any) => unknown;

export interface SchemaLike<TOutput = unknown> {
  parse(value: unknown): TOutput;
}

export interface RouterSchemaEntry<
  TSearchSchema extends SchemaLike<any> | undefined = SchemaLike<any> | undefined,
> {
  searchSchema?: TSearchSchema;
  serverHead?: true;
}

export type RouterSchemaShape = Record<string, RouterSchemaEntry>;

export function defineRouterSchema<const TSchema extends RouterSchemaShape>(schema: TSchema): TSchema {
  return schema;
}

type SchemaOutput<TSchema> = TSchema extends { _output: infer TOutput }
  ? TOutput
  : TSchema extends SchemaLike<infer TOutput>
    ? TOutput
    : never;

export type InferRouterSearchSchema<
  TSchema extends RouterSchemaShape,
  TRouteId extends string,
> = TRouteId extends keyof TSchema
  ? TSchema[TRouteId] extends { searchSchema: infer TSearchSchema }
    ? SchemaOutput<TSearchSchema>
    : {}
  : {};

export type RouteIdsWithServerHead<TSchema extends RouterSchemaShape> = {
  [TRouteId in keyof TSchema]: TSchema[TRouteId] extends { serverHead: true } ? TRouteId : never;
}[keyof TSchema] & string;

export type RouteUsesServerHead<TSchema extends RouterSchemaShape, TRouteId extends string> = TRouteId extends keyof TSchema
  ? TSchema[TRouteId] extends { serverHead: true }
    ? true
    : false
  : false;

export type ResolveAllParamsForRouteId<TRouteId extends string> = TRouteId extends '__root__'
  ? ResolveAllParams<'/'>
  : ResolveAllParams<TRouteId>;

export type Simplify<TValue> = { [TKey in keyof TValue]: TValue[TKey] } & {};

type NormalizePathInternal<TValue extends string> = TValue extends `/${infer TRest}`
  ? NormalizePathSegments<TRest> extends infer TSegments extends string
    ? TSegments extends ''
      ? '/'
      : `/${TSegments}`
    : never
  : TValue;

type NormalizePathSegments<TValue extends string> = TValue extends `${infer THead}/${infer TTail}`
  ? JoinNormalizedSegments<NormalizePathSegment<THead>, NormalizePathSegments<TTail>>
  : NormalizePathSegment<TValue>;

type JoinNormalizedSegments<TLeft extends string, TRight extends string> = TLeft extends ''
  ? TRight
  : TRight extends ''
    ? TLeft
    : `${TLeft}/${TRight}`;

type NormalizePathSegment<TSegment extends string> = TSegment extends ''
  ? ''
  : TSegment extends `_${string}`
    ? ''
    : TSegment extends `${infer TBase}_`
      ? TBase
      : TSegment;

export type NormalizeRouteId<TValue extends string> = TValue extends '__root__'
  ? '/'
  : TValue extends '/'
    ? '/'
    : TValue extends `${infer TPrefix}/`
      ? TPrefix extends ''
        ? '/'
        : NormalizePathInternal<TPrefix>
      : NormalizePathInternal<TValue>;

type ParsePathParamsInternal<TValue extends string> = TValue extends `${infer _Start}/$/${infer TRest}`
  ? '_splat' | ParsePathParamsInternal<`/${TRest}`>
  : TValue extends `${infer _Start}/$`
    ? '_splat'
    : TValue extends `${infer _Start}/$${infer TParam}/${infer TRest}`
      ? TParam | ParsePathParamsInternal<`/${TRest}`>
      : TValue extends `${infer _Start}/$${infer TParam}`
        ? TParam
        : never;

export type ParsePathParams<TPath extends string> = ParsePathParamsInternal<NormalizeRouteId<TPath>>;

export type ResolveAllParams<TPath extends string> = Simplify<{
  [TKey in ParsePathParams<TPath>]: string;
}>;

export interface HeadTagTitle {
  title: string;
}

export interface HeadTagName {
  name: string;
  content: string;
}

export interface HeadTagProperty {
  property: string;
  content: string;
}

export interface HeadTagHttpEquiv {
  httpEquiv: string;
  content: string;
}

export interface HeadTagCharset {
  charset: string;
}

export type HeadTag =
  | HeadTagTitle
  | HeadTagName
  | HeadTagProperty
  | HeadTagHttpEquiv
  | HeadTagCharset;

export interface HeadLinkTag {
  rel: string;
  href: string;
  type?: string;
  media?: string;
  sizes?: string;
  crossorigin?: string;
}

export interface HeadStyleTag {
  children: string;
  media?: string;
}

export interface HeadScriptTag {
  src?: string;
  children?: string;
  type?: string;
  async?: boolean;
  defer?: boolean;
}

export interface HeadConfig {
  meta?: HeadTag[];
  links?: HeadLinkTag[];
  styles?: HeadStyleTag[];
  scripts?: HeadScriptTag[];
}

export interface DehydratedHeadState {
  href: string;
  head: HeadConfig;
}

export interface ParsedLocation<TSearch = Record<string, unknown>> {
  pathname: string;
  search: TSearch;
  searchStr: string;
  hash: string;
  href: string;
  state: unknown;
}

export interface RedirectTarget {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, unknown> | true;
  hash?: string;
  replace?: boolean;
  state?: Record<string, unknown>;
}

export class RedirectError extends Error {
  constructor(public readonly options: RedirectTarget) {
    super(`Redirect to ${options.to}`);
    this.name = 'RedirectError';
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Not Found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export function redirect(options: RedirectTarget): never {
  throw new RedirectError(options);
}

export function notFound(message?: string): never {
  throw new NotFoundError(message);
}

export function isRedirect(error: unknown): error is RedirectError {
  return error instanceof RedirectError;
}

export function isNotFound(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

export interface RouteMatch<TRoute extends AnyRoute = AnyRoute> {
  id: string;
  pathname: string;
  params: Record<string, string>;
  route: TRoute;
  search: unknown;
  to: string;
}

export interface RouteOptions<TPath extends string = string, TSearch = unknown> {
  component?: AnyComponent;
  pendingComponent?: AnyComponent;
  errorComponent?: AnyComponent;
  notFoundComponent?: AnyComponent;
  head?:
    | HeadConfig
    | ((ctx: {
        params: ResolveAllParams<TPath>;
        search: TSearch;
        matches: RouteMatch[];
      }) => HeadConfig);
  beforeLoad?: (ctx: {
    location: ParsedLocation;
    params: ResolveAllParams<TPath>;
    search: TSearch;
    navigate: (options: RedirectTarget) => Promise<void>;
    cause: 'enter' | 'stay';
  }) => void | Promise<void>;
  pendingMs?: number;
  pendingMinMs?: number;
  staticData?: Record<string, unknown>;
}

export interface RouteTypeInfo<
  TId extends string = string,
  TTo extends string = string,
  TParams extends Record<string, string> = Record<string, string>,
  TSearch = unknown,
> {
  id: TId;
  fullPath: TId;
  to: TTo;
  params: TParams;
  search: TSearch;
}

export class RouteNode<
  TId extends string = string,
  TTo extends string = string,
  TParams extends Record<string, string> = Record<string, string>,
  TSearch = unknown,
  TFileTypes = unknown,
> {
  public id: TId;
  public fullPath: TId;
  public to: TTo;
  public parent?: AnyRoute;
  public children: AnyRoute[] = [];
  public searchSchema?: SchemaLike<TSearch>;
  public serverHead = false;
  public routeTypes?: TFileTypes;
  public readonly isRoot: boolean;
  public readonly options: RouteOptions<TId, TSearch>;
  declare public types: RouteTypeInfo<TId, TTo, TParams, TSearch>;
  declare public __fileTypes: TFileTypes;

  constructor(path: TId, options: RouteOptions<TId, TSearch>, init?: { isRoot?: boolean }) {
    this.id = path;
    this.fullPath = path;
    this.to = normalizeRouteIdRuntime(path) as TTo;
    this.options = options;
    this.isRoot = init?.isRoot ?? false;
  }

  public update(config: {
    id: TId;
    path: TId;
    getParentRoute?: () => AnyRoute;
  }): this {
    this.id = config.id;
    this.fullPath = config.path;
    this.to = normalizeRouteIdRuntime(config.path) as TTo;
    this.parent = config.getParentRoute?.();
    return this;
  }

  public _addFileChildren<TChildren extends Record<string, AnyRoute>>(children: TChildren): this {
    this.children = Object.values(children);
    for (const child of this.children) {
      child.parent = this;
    }
    return this;
  }

  public _addFileTypes<TNextFileTypes>(): RouteNode<
    TId,
    TTo,
    TParams,
    TSearch,
    TNextFileTypes
  > {
    return this as unknown as RouteNode<
      TId,
      TTo,
      TParams,
      TSearch,
      TNextFileTypes
    >;
  }

  public _setSearchSchema<TSchema extends SchemaLike<TSearch> | undefined>(schema: TSchema): this {
    this.searchSchema = schema;
    return this;
  }

  public _setServerHead(serverHead: boolean | undefined): this {
    this.serverHead = serverHead === true;
    return this;
  }
}

export type AnyRoute = RouteNode<any, any, any, any, any>;

export function createRouteNode<
  TId extends string,
  TTo extends string,
  TParams extends Record<string, string>,
  TSearch,
>(
  path: TId,
  options: RouteOptions<TId, TSearch>,
  init?: { isRoot?: boolean },
): RouteNode<TId, TTo, TParams, TSearch> {
  return new RouteNode(path, options, init) as RouteNode<TId, TTo, TParams, TSearch>;
}

export function normalizeRouteIdRuntime(routeId: string): string {
  if (routeId === '__root__' || routeId === '/') {
    return '/';
  }

  const withoutTrailingSlash = routeId !== '/' && routeId.endsWith('/') ? routeId.slice(0, -1) : routeId;
  const segments = withoutTrailingSlash
    .split('/')
    .filter(Boolean)
    .map(segment => {
      if (segment.startsWith('_')) {
        return null;
      }

      if (segment.endsWith('_')) {
        return segment.slice(0, -1);
      }

      return segment;
    })
    .filter((segment): segment is string => Boolean(segment));

  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
}

export function isIndexRoute(route: AnyRoute): boolean {
  return !route.isRoot && route.fullPath.endsWith('/');
}

export function isPathlessRoute(route: AnyRoute): boolean {
  return !route.isRoot && !isIndexRoute(route) && route.parent !== undefined && route.to === route.parent.to;
}

export function parseSearchValue(value: string): unknown {
  if (value === '') {
    return '';
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function defaultParseSearch(searchStr: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const params = new URLSearchParams(searchStr.startsWith('?') ? searchStr.slice(1) : searchStr);

  for (const [key, value] of params.entries()) {
    result[key] = parseSearchValue(value);
  }

  return result;
}

export function defaultStringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(search)) {
    if (value === undefined) {
      continue;
    }

    params.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

function normalizePattern(pattern: string): string[] {
  if (pattern === '/') {
    return [];
  }

  return pattern.split('/').filter(Boolean);
}

export function buildPath(to: string, params: Record<string, string> = {}): string {
  const normalized = normalizeRouteIdRuntime(to);

  if (normalized === '/') {
    return '/';
  }

  const segments = normalized.split('/').filter(Boolean).map(segment => {
    if (segment === '$') {
      return encodeURIComponent(params._splat ?? '');
    }

    if (segment.startsWith('$')) {
      const key = segment.slice(1);
      const value = params[key];

      if (value === undefined) {
        throw new Error(`Missing route param "${key}" for path "${to}"`);
      }

      return encodeURIComponent(value);
    }

    return segment;
  });

  return `/${segments.join('/')}`;
}

export function matchPathname(
  pattern: string,
  pathname: string,
  options?: { partial?: boolean },
): { params: Record<string, string> } | null {
  const patternSegments = normalizePattern(normalizeRouteIdRuntime(pattern));
  const pathnameSegments = normalizePattern(pathname);
  const params: Record<string, string> = {};

  if (patternSegments.length === 0) {
    if (!options?.partial && pathnameSegments.length > 0) {
      return null;
    }

    return { params };
  }

  let pathnameIndex = 0;

  for (let patternIndex = 0; patternIndex < patternSegments.length; patternIndex += 1) {
    const segment = patternSegments[patternIndex];
    if (segment === undefined) {
      return null;
    }

    if (segment === '$') {
      params._splat = decodeURIComponent(pathnameSegments.slice(pathnameIndex).join('/'));
      pathnameIndex = pathnameSegments.length;
      break;
    }

    const current = pathnameSegments[pathnameIndex];
    if (current === undefined) {
      return null;
    }

    if (segment.startsWith('$')) {
      params[segment.slice(1)] = decodeURIComponent(current);
      pathnameIndex += 1;
      continue;
    }

    if (segment !== current) {
      return null;
    }

    pathnameIndex += 1;
  }

  if (!options?.partial && pathnameIndex < pathnameSegments.length) {
    return null;
  }

  return { params };
}

function scorePattern(pattern: string): number {
  return normalizePattern(pattern).reduce((score, segment) => {
    if (segment === '$') {
      return score + 1;
    }

    if (segment.startsWith('$')) {
      return score + 2;
    }

    return score + 3;
  }, 0);
}

export interface RouteBranch {
  leaf: AnyRoute;
  routes: AnyRoute[];
  score: number;
}

function canTerminate(route: AnyRoute): boolean {
  if (route.isRoot || isPathlessRoute(route)) {
    return false;
  }

  if (route.children.length === 0) {
    return true;
  }

  return !route.children.some((child: AnyRoute) => isIndexRoute(child));
}

export function collectBranches(routeTree: AnyRoute): RouteBranch[] {
  const branches: RouteBranch[] = [];

  function walk(route: AnyRoute, ancestors: AnyRoute[]): void {
    const nextAncestors = [...ancestors, route];

    if (canTerminate(route)) {
      branches.push({
        leaf: route,
        routes: nextAncestors,
        score: scorePattern(route.to) + nextAncestors.length,
      });
    }

    for (const child of route.children) {
      walk(child, nextAncestors);
    }
  }

  walk(routeTree, []);

  return branches.sort((left, right) => right.score - left.score);
}

export function collectRoutes(routeTree: AnyRoute): AnyRoute[] {
  const routes: AnyRoute[] = [];

  function walk(route: AnyRoute): void {
    routes.push(route);
    for (const child of route.children) {
      walk(child);
    }
  }

  walk(routeTree);
  return routes;
}

export interface MatchedRoute {
  route: AnyRoute;
  params: Record<string, string>;
}

export function matchRouteTree(routeTree: AnyRoute, pathname: string): MatchedRoute[] | null {
  const branches = collectBranches(routeTree);

  for (const branch of branches) {
    const leafMatch = matchPathname(branch.leaf.to, pathname);
    if (!leafMatch) {
      continue;
    }

    const matched = branch.routes.map(route => {
      const partialMatch = matchPathname(route.to, pathname, {
        partial: route !== branch.leaf,
      });

      return {
        route,
        params: partialMatch?.params ?? {},
      };
    });

    return matched;
  }

  return null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderAttributes(attributes: Record<string, string | boolean | undefined>): string {
  return Object.entries(attributes)
    .flatMap(([key, value]) => {
      if (value === undefined || value === false) {
        return [];
      }

      if (value === true) {
        return [key];
      }

      return [`${key}="${escapeHtml(value)}"`];
    })
    .join(' ');
}

export function mergeHeadConfigs(heads: HeadConfig[]): HeadConfig {
  const titles: HeadTagTitle[] = [];
  const metaByKey = new Map<string, HeadTag>();
  const linksByKey = new Map<string, HeadLinkTag>();
  const styles: HeadStyleTag[] = [];
  const scripts: HeadScriptTag[] = [];

  for (const head of heads) {
    for (const meta of head.meta ?? []) {
      if ('title' in meta) {
        titles.push(meta);
        continue;
      }

      if ('charset' in meta) {
        metaByKey.set('charset', meta);
        continue;
      }

      if ('name' in meta) {
        metaByKey.set(`name:${meta.name}`, meta);
        continue;
      }

      if ('property' in meta) {
        metaByKey.set(`property:${meta.property}`, meta);
        continue;
      }

      metaByKey.set(`httpEquiv:${meta.httpEquiv}`, meta);
    }

    for (const link of head.links ?? []) {
      linksByKey.set(`${link.rel}:${link.href}`, link);
    }

    styles.push(...(head.styles ?? []));
    scripts.push(...(head.scripts ?? []));
  }

  const title = titles.at(-1);
  return {
    meta: [...(title ? [title] : []), ...metaByKey.values()],
    links: [...linksByKey.values()],
    styles,
    scripts,
  };
}

function resolveInlineHead(match: RouteMatch, matches: RouteMatch[]): HeadConfig | null {
  const headOption = match.route.options.head;
  if (!headOption || typeof headOption === 'string') {
    return null;
  }

  return typeof headOption === 'function'
    ? headOption({
        params: match.params as never,
        search: match.search,
        matches,
      })
    : headOption;
}

export function resolveHeadConfig(
  matches: RouteMatch[],
  resolvedHeadByRoute?: Map<string, HeadConfig>,
): HeadConfig {
  const heads: HeadConfig[] = [];

  for (const match of matches) {
    const resolvedHead = resolvedHeadByRoute?.get(match.route.fullPath);
    if (resolvedHead) {
      heads.push(resolvedHead);
    }

    const inlineHead = resolveInlineHead(match, matches);
    if (inlineHead) {
      heads.push(inlineHead);
    }
  }

  return mergeHeadConfigs(heads);
}

export function serializeHeadConfig(
  head: HeadConfig,
  options?: {
    managedAttribute?: string;
  },
): string {
  const managedAttributes = options?.managedAttribute
    ? {
        [options.managedAttribute]: 'true',
      }
    : {};

  const meta = (head.meta ?? []).map(tag => {
    if ('title' in tag) {
      return `<title ${renderAttributes(managedAttributes)}>${escapeHtml(tag.title)}</title>`;
    }

    if ('charset' in tag) {
      return `<meta ${renderAttributes({ charset: tag.charset, ...managedAttributes })}>`;
    }

    if ('name' in tag) {
      return `<meta ${renderAttributes({ name: tag.name, content: tag.content, ...managedAttributes })}>`;
    }

    if ('property' in tag) {
      return `<meta ${renderAttributes({ property: tag.property, content: tag.content, ...managedAttributes })}>`;
    }

    return `<meta ${renderAttributes({ 'http-equiv': tag.httpEquiv, content: tag.content, ...managedAttributes })}>`;
  });

  const links = (head.links ?? []).map(link => `<link ${renderAttributes({
    rel: link.rel,
    href: link.href,
    type: link.type,
    media: link.media,
    sizes: link.sizes,
    crossorigin: link.crossorigin,
    ...managedAttributes,
  })}>`);

  const styles = (head.styles ?? []).map(style => {
    const attributes = renderAttributes({ media: style.media, ...managedAttributes });
    return `<style${attributes ? ` ${attributes}` : ''}>${style.children}</style>`;
  });

  const scripts = (head.scripts ?? []).map(script => {
    const attributes = renderAttributes({
      src: script.src,
      type: script.type,
      async: script.async,
      defer: script.defer,
      ...managedAttributes,
    });

    return `<script${attributes ? ` ${attributes}` : ''}>${script.children ?? ''}</script>`;
  });

  return [...meta, ...links, ...styles, ...scripts].join('');
}

export function createParsedLocation<TSearch>(
  href: string,
  state: unknown,
  parseSearch: (searchStr: string) => TSearch,
): ParsedLocation<TSearch> {
  const base = href.startsWith('http://') || href.startsWith('https://') ? href : `http://richie-router.local${href}`;
  const url = new URL(base);
  return {
    pathname: url.pathname,
    search: parseSearch(url.search),
    searchStr: url.search,
    hash: url.hash,
    href: `${url.pathname}${url.search}${url.hash}`,
    state,
  };
}
