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
export interface RouterSchemaOptions {
  passthrough?: string[];
  headBasePath?: string;
}

export interface HostedRoutingConfig {
  passthrough: string[];
  headBasePath: string;
}

export const ROUTER_SCHEMA_CONFIG_KEY = Symbol.for('richie-router.router-schema-config');
export const DEFAULT_HEAD_BASE_PATH = '/head-api';

export type RouterSchema<TRoutes extends RouterSchemaShape = RouterSchemaShape> = TRoutes & {
  readonly [ROUTER_SCHEMA_CONFIG_KEY]?: HostedRoutingConfig;
};

export type AnyRouterSchema = RouterSchemaShape & {
  readonly [ROUTER_SCHEMA_CONFIG_KEY]?: HostedRoutingConfig;
};

export type RouterSchemaRoutes<TSchema extends AnyRouterSchema> = {
  [TRouteId in keyof TSchema as TRouteId extends typeof ROUTER_SCHEMA_CONFIG_KEY ? never : TRouteId]: TSchema[TRouteId];
};

export type RouterSchemaRouteIds<TSchema extends AnyRouterSchema> = Extract<keyof RouterSchemaRoutes<TSchema>, string>;

function ensureLeadingSlash(value: string): string {
  return value.startsWith('/') ? value : `/${value}`;
}

function normalizeHostedPath(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '/') {
    return '/';
  }

  return ensureLeadingSlash(trimmed).replace(/\/+$/u, '') || '/';
}

function dedupePaths(values: string[]): string[] {
  const unique = new Set<string>();

  for (const value of values) {
    if (!unique.has(value)) {
      unique.add(value);
    }
  }

  return [...unique];
}

export function resolveHostedRoutingConfig(config?: Partial<HostedRoutingConfig> | RouterSchemaOptions): HostedRoutingConfig {
  const headBasePath = normalizeHostedPath(config?.headBasePath ?? DEFAULT_HEAD_BASE_PATH);
  const passthrough = dedupePaths([
    headBasePath,
    ...(config?.passthrough ?? []).map(normalizeHostedPath),
  ]);

  return {
    headBasePath,
    passthrough,
  };
}

export function defineRouterSchema<const TRoutes extends RouterSchemaShape>(
  routes: TRoutes,
  options?: RouterSchemaOptions,
): RouterSchema<TRoutes> {
  const schema = { ...routes } as RouterSchema<TRoutes>;

  Object.defineProperty(schema, ROUTER_SCHEMA_CONFIG_KEY, {
    value: resolveHostedRoutingConfig(options),
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return schema;
}

type SchemaOutput<TSchema> = TSchema extends { _output: infer TOutput }
  ? TOutput
  : TSchema extends SchemaLike<infer TOutput>
    ? TOutput
    : never;

export type InferRouterSearchSchema<
  TSchema extends AnyRouterSchema,
  TRouteId extends string,
> = TRouteId extends RouterSchemaRouteIds<TSchema>
  ? RouterSchemaRoutes<TSchema>[TRouteId] extends { searchSchema: infer TSearchSchema }
    ? SchemaOutput<TSearchSchema>
    : {}
  : {};

export type RouteIdsWithServerHead<TSchema extends AnyRouterSchema> = {
  [TRouteId in RouterSchemaRouteIds<TSchema>]:
    RouterSchemaRoutes<TSchema>[TRouteId] extends { serverHead: true } ? TRouteId : never;
}[RouterSchemaRouteIds<TSchema>] & string;

export type RouteUsesServerHead<TSchema extends AnyRouterSchema, TRouteId extends string> = TRouteId extends RouterSchemaRouteIds<TSchema>
  ? RouterSchemaRoutes<TSchema>[TRouteId] extends { serverHead: true }
    ? true
    : false
  : false;

export function getRouteSchemaEntry<TSchema extends AnyRouterSchema>(
  schema: TSchema,
  routeId: string,
): RouterSchemaEntry | undefined {
  return (schema as RouterSchemaShape)[routeId];
}

export function getRouterSchemaHostedRouting(schema: AnyRouterSchema): HostedRoutingConfig {
  return resolveHostedRoutingConfig(schema[ROUTER_SCHEMA_CONFIG_KEY]);
}

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

export type HeadElementAttributeValue = string | boolean;

export type HeadElementAttributes = Record<string, HeadElementAttributeValue | undefined>;

export interface HeadTitleTag {
  tag: 'title';
  children: string;
  key?: string;
}

export interface HeadMetaCharsetTag {
  tag: 'meta';
  charset: string;
  key?: string;
}

export interface HeadMetaNameTag {
  tag: 'meta';
  name: string;
  content: string;
  key?: string;
}

export interface HeadMetaPropertyTag {
  tag: 'meta';
  property: string;
  content: string;
  key?: string;
}

export interface HeadMetaHttpEquivTag {
  tag: 'meta';
  httpEquiv: string;
  content: string;
  key?: string;
}

export type HeadMetaTag =
  | HeadMetaCharsetTag
  | HeadMetaNameTag
  | HeadMetaPropertyTag
  | HeadMetaHttpEquivTag;

export interface HeadLinkTag {
  tag: 'link';
  rel: string;
  href: string;
  type?: string;
  media?: string;
  sizes?: string;
  crossorigin?: string;
  key?: string;
}

export interface HeadStyleTag {
  tag: 'style';
  children: string;
  media?: string;
  key?: string;
}

export interface HeadScriptTag {
  tag: 'script';
  src?: string;
  children?: string;
  type?: string;
  async?: boolean;
  defer?: boolean;
  key?: string;
}

export interface HeadBaseTag {
  tag: 'base';
  href: string;
  target?: string;
  key?: string;
}

export interface HeadCustomElementTag {
  tag: 'custom';
  name: string;
  attrs?: HeadElementAttributes;
  children?: string;
  key?: string;
}

export type HeadElementTag =
  | HeadTitleTag
  | HeadMetaTag
  | HeadLinkTag
  | HeadStyleTag
  | HeadScriptTag
  | HeadBaseTag
  | HeadCustomElementTag;

export type HeadConfig = HeadElementTag[];

export interface RouteHeadEntry {
  routeId: string;
  head: HeadConfig;
  staleTime?: number;
}

export interface DehydratedHeadState {
  href: string;
  head: HeadConfig;
  routeHeads?: RouteHeadEntry[];
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
  public hostedRouting: HostedRoutingConfig = resolveHostedRoutingConfig();
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

  public _setHostedRouting(config: HostedRoutingConfig | undefined): this {
    this.hostedRouting = resolveHostedRoutingConfig(config);
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

function scoreSegmentSpecificity(segment: string | undefined): number {
  if (segment === undefined) {
    return -1;
  }

  if (segment === '$') {
    return 1;
  }

  if (segment.startsWith('$')) {
    return 2;
  }

  return 3;
}

function comparePatternSpecificity(leftPattern: string, rightPattern: string): number {
  const leftSegments = normalizePattern(leftPattern);
  const rightSegments = normalizePattern(rightPattern);
  const maxLength = Math.max(leftSegments.length, rightSegments.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftSpecificity = scoreSegmentSpecificity(leftSegments[index]);
    const rightSpecificity = scoreSegmentSpecificity(rightSegments[index]);

    if (leftSpecificity !== rightSpecificity) {
      return rightSpecificity - leftSpecificity;
    }
  }

  if (leftSegments.length !== rightSegments.length) {
    return rightSegments.length - leftSegments.length;
  }

  return 0;
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

  return branches.sort((left, right) => {
    const specificityComparison = comparePatternSpecificity(left.leaf.to, right.leaf.to);
    if (specificityComparison !== 0) {
      return specificityComparison;
    }

    if (left.score !== right.score) {
      return right.score - left.score;
    }

    return right.routes.length - left.routes.length;
  });
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

function renderHeadElementName(element: HeadElementTag): string {
  return element.tag === 'custom' ? element.name : element.tag;
}

function isVoidHeadElement(element: HeadElementTag): boolean {
  return element.tag === 'meta' || element.tag === 'link' || element.tag === 'base';
}

function resolveHeadElementAttributes(element: HeadElementTag): HeadElementAttributes {
  switch (element.tag) {
    case 'title':
      return {};
    case 'meta':
      if ('charset' in element) {
        return { charset: element.charset };
      }

      if ('name' in element) {
        return { name: element.name, content: element.content };
      }

      if ('property' in element) {
        return { property: element.property, content: element.content };
      }

      return { 'http-equiv': element.httpEquiv, content: element.content };
    case 'link':
      return {
        rel: element.rel,
        href: element.href,
        type: element.type,
        media: element.media,
        sizes: element.sizes,
        crossorigin: element.crossorigin,
      };
    case 'style':
      return {
        media: element.media,
      };
    case 'script':
      return {
        src: element.src,
        type: element.type,
        async: element.async,
        defer: element.defer,
      };
    case 'base':
      return {
        href: element.href,
        target: element.target,
      };
    case 'custom':
      return element.attrs ?? {};
  }
}

function resolveHeadElementChildren(element: HeadElementTag): string | undefined {
  if (element.tag === 'meta' || element.tag === 'link' || element.tag === 'base') {
    return undefined;
  }

  return element.children;
}

function renderHeadElementTag(
  element: HeadElementTag,
  options?: {
    managedAttribute?: string;
  },
): string {
  const managedAttributes = options?.managedAttribute
    ? {
        [options.managedAttribute]: 'true',
      }
    : {};
  const tagName = renderHeadElementName(element);
  const attributes = renderAttributes({
    ...resolveHeadElementAttributes(element),
    ...managedAttributes,
  });
  const openTag = `<${tagName}${attributes ? ` ${attributes}` : ''}>`;

  if (isVoidHeadElement(element)) {
    return openTag;
  }

  const children = resolveHeadElementChildren(element);
  const renderedChildren = element.tag === 'title' ? escapeHtml(children ?? '') : (children ?? '');
  return `${openTag}${renderedChildren}</${tagName}>`;
}

function getHeadElementIdentity(element: HeadElementTag): string | null {
  if (element.key) {
    return `key:${element.key}`;
  }

  switch (element.tag) {
    case 'title':
      return 'title';
    case 'meta':
      if ('charset' in element) {
        return 'meta:charset';
      }

      if ('name' in element) {
        return `meta:name:${element.name}`;
      }

      if ('property' in element) {
        return `meta:property:${element.property}`;
      }

      return `meta:httpEquiv:${element.httpEquiv}`;
    case 'link':
      return `link:${element.rel}:${element.href}`;
    case 'base':
      return 'base';
    case 'style':
    case 'script':
    case 'custom':
      return null;
  }
}

export function mergeHeadConfigs(heads: HeadConfig[]): HeadConfig {
  const elements: Array<HeadElementTag | null> = [];
  const elementIndexesByIdentity = new Map<string, number>();

  for (const head of heads) {
    for (const element of head) {
      const identity = getHeadElementIdentity(element);
      if (identity !== null) {
        const previousIndex = elementIndexesByIdentity.get(identity);
        if (previousIndex !== undefined) {
          elements[previousIndex] = null;
        }

        elementIndexesByIdentity.set(identity, elements.length);
      }

      elements.push(element);
    }
  }

  return elements.filter((element): element is HeadElementTag => element !== null);
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
  return head.map(element => renderHeadElementTag(element, options)).join('');
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
