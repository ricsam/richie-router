import React from 'react';
import {
  RouteNode,
  buildPath,
  collectBranches,
  collectRoutes,
  createParsedLocation,
  createRouteNode,
  defaultParseSearch,
  defaultStringifySearch,
  isNotFound,
  isRedirect,
  matchRouteTree,
  normalizeRouteIdRuntime,
  notFound,
  redirect,
  resolveHeadConfig,
} from '@richie-router/core';
import type {
  AnyComponent,
  AnyRoute,
  DehydratedHeadState,
  HeadConfig,
  NormalizeRouteId,
  ParsedLocation,
  ResolveAllParams,
  RouteHeadEntry,
  RouteMatch,
  RouteOptions as CoreRouteOptions,
  Simplify,
} from '@richie-router/core';
import {
  createBrowserHistory,
  createHashHistory,
  createMemoryHistory,
} from './history';
import type { MemoryHistoryOptions, RouterHistory } from './history';

declare global {
  interface Window {
    __RICHIE_ROUTER_HEAD__?: DehydratedHeadState;
  }
}

export interface Register {}

type RegisteredRouteSearchSchema = Register extends {
  routeSearchSchema: infer TRouteSearchSchema;
}
  ? TRouteSearchSchema
  : Record<string, {}>;

type RegisteredRouteTree = Register extends { routeTree: infer TRouteTree } ? TRouteTree : AnyRoute;

interface DefaultFileTypes {
  fullPaths: string;
  to: string;
  id: string;
  fileRoutesById: Record<string, AnyRoute>;
  fileRoutesByTo: Record<string, AnyRoute>;
  fileRoutesByFullPath: Record<string, AnyRoute>;
}

type RegisteredFileTypes = RegisteredRouteTree extends { __fileTypes: infer TFileTypes }
  ? TFileTypes
  : DefaultFileTypes;

type RegisteredRoutesByTo = RegisteredFileTypes extends { fileRoutesByTo: infer TRoutesByTo }
  ? TRoutesByTo
  : Record<string, AnyRoute>;

type RegisteredRoutesByFullPath = RegisteredFileTypes extends { fileRoutesByFullPath: infer TRoutesByFullPath }
  ? TRoutesByFullPath
  : Record<string, AnyRoute>;

export type RegisteredRouter = Register extends { router: infer TRouter } ? TRouter : Router<AnyRoute>;

export type RoutePaths = RegisteredFileTypes extends { to: infer TTo } ? TTo & string : string;

export type RouteById<TPath extends string> = TPath extends keyof RegisteredRoutesByTo
  ? RegisteredRoutesByTo[TPath]
  : never;

type RouteByFullPath<TPath extends string> = TPath extends keyof RegisteredRoutesByFullPath
  ? RegisteredRoutesByFullPath[TPath]
  : never;

type ParamsOfRoute<TRoute> = TRoute extends { types: { params: infer TParams } }
  ? TParams
  : Record<string, string>;

type SearchOfRoute<TRoute> = TRoute extends { types: { search: infer TSearch } } ? TSearch : unknown;

type MatchOfRoute<TRoute> = {
  id: string;
  pathname: string;
  params: ParamsOfRoute<TRoute>;
  route: TRoute;
  search: SearchOfRoute<TRoute>;
  to: TRoute extends { types: { to: infer TTo } } ? TTo : string;
};

type SafeRouteByTo<TTo extends string> = [RouteById<TTo>] extends [never] ? AnyRoute : RouteById<TTo>;
type ParamsForTo<TTo extends string> = ParamsOfRoute<SafeRouteByTo<TTo>>;
type SearchForTo<TTo extends string> = SearchOfRoute<SafeRouteByTo<TTo>>;
type SearchForRouteId<TPath extends string> = TPath extends keyof RegisteredRouteSearchSchema
  ? RegisteredRouteSearchSchema[TPath]
  : {};

type ParamsInput<TParams> = TParams | ((previous: TParams) => TParams);
type SearchInput<TSearch> = TSearch | ((previous: TSearch) => TSearch) | true;

type ParamsOption<TParams> = keyof TParams extends never
  ? { params?: never }
  : { params: ParamsInput<TParams> };

type ClientHeadOption<TPath extends string, TSearch> =
  | HeadConfig
  | ((ctx: {
      params: ResolveAllParams<TPath>;
      search: TSearch;
      matches: RouteMatch[];
    }) => HeadConfig);

type RouteOptionsInput<TPath extends string, TSearch> = Omit<CoreRouteOptions<TPath, TSearch>, 'head'> & {
  head?: ClientHeadOption<TPath, TSearch>;
};

type FileRouteInstance<
  TPath extends string,
  TSearch,
  TFileTypes = unknown,
  THasInlineHead extends boolean = boolean,
> = RouteNode<
  TPath,
  NormalizeRouteId<TPath>,
  ResolveAllParams<TPath>,
  TSearch,
  TFileTypes
> &
  RouteApiMethods<
    RouteNode<
      TPath,
      NormalizeRouteId<TPath>,
      ResolveAllParams<TPath>,
      TSearch,
      TFileTypes
    >
  > & {
    __hasInlineHead: THasInlineHead;
  };

export interface TypedRouteMatch<
  TPath extends string,
  TSearch,
  TRoute extends AnyRoute = AnyRoute,
> extends Omit<RouteMatch<TRoute>, 'params' | 'search'> {
  params: ResolveAllParams<TPath>;
  search: TSearch;
}

interface RouteApiMethods<TRoute extends AnyRoute> {
  useParams(): ParamsOfRoute<TRoute>;
  useSearch(): SearchOfRoute<TRoute>;
  useNavigate(): NavigateFn;
  useMatch(): MatchOfRoute<TRoute>;
}

export interface NavigateBaseOptions {
  from?: RoutePaths;
  hash?: string;
  replace?: boolean;
  resetScroll?: boolean;
  state?: Record<string, unknown>;
  mask?: {
    to: string;
  };
  ignoreBlocker?: boolean;
}

export type NavigateOptions<TTo extends RoutePaths = RoutePaths> = {
  to: TTo;
  search?: SearchInput<SearchForTo<TTo>>;
} & NavigateBaseOptions &
  ParamsOption<ParamsForTo<TTo>>;

export type NavigateFn = <TTo extends RoutePaths>(options: NavigateOptions<TTo>) => Promise<void>;

export type LinkOwnProps<TTo extends RoutePaths> = NavigateOptions<TTo> & {
  preload?: 'intent' | 'render' | false;
  activeProps?: React.AnchorHTMLAttributes<HTMLAnchorElement>;
  children?: React.ReactNode | ((ctx: { isActive: boolean }) => React.ReactNode);
};

export type LinkProps<TTo extends RoutePaths = RoutePaths> = LinkOwnProps<TTo> &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkOwnProps<TTo> | 'href'>;

export interface RouterState {
  status: 'idle' | 'loading';
  location: ParsedLocation;
  matches: RouteMatch[];
  head: HeadConfig;
  error: unknown;
}

export interface RouterOptions<TRouteTree extends AnyRoute> {
  routeTree: TRouteTree;
  history?: RouterHistory;
  basePath?: string;
  defaultPreload?: 'intent' | 'render' | false;
  defaultPreloadDelay?: number;
  defaultPendingMs?: number;
  defaultPendingMinMs?: number;
  defaultNotFoundComponent?: AnyComponent;
  defaultErrorComponent?: AnyComponent;
  scrollRestoration?: boolean;
  scrollToTopSelectors?: string[];
  headBasePath?: string;
  trailingSlash?: 'always' | 'never' | 'preserve';
  parseSearch?: (searchStr: string) => Record<string, unknown>;
  stringifySearch?: (search: Record<string, unknown>) => string;
  loadRouteHead?: (ctx: {
    route: AnyRoute;
    routeId: string;
    params: Record<string, string>;
    search: unknown;
    location: ParsedLocation;
    request?: Request;
  }) => Promise<{ head: HeadConfig; staleTime?: number }>;
}

type InternalRouteMatch = RouteMatch & { id: string };

type Selector<TSelection> = (state: RouterState) => TSelection;

type CachedHeadEntry = {
  head: HeadConfig;
  expiresAt: number;
};

type DocumentHeadResponsePayload = {
  head: HeadConfig;
  routeHeads?: RouteHeadEntry[];
  staleTime?: number;
};

const RouterContext = React.createContext<Router<AnyRoute> | null>(null);
const RouterStateContext = React.createContext<RouterState | null>(null);
const OutletContext = React.createContext<React.ReactNode>(null);
const MatchContext = React.createContext<RouteMatch | null>(null);
const MANAGED_HEAD_ATTRIBUTE = 'data-richie-router-head';
const EMPTY_HEAD: HeadConfig = [];

function ensureLeadingSlash(value: string): string {
  return value.startsWith('/') ? value : `/${value}`;
}

function normalizeBasePath(basePath?: string): string {
  if (!basePath) {
    return '';
  }

  const trimmed = basePath.trim();
  if (trimmed === '' || trimmed === '/') {
    return '';
  }

  const normalized = ensureLeadingSlash(trimmed).replace(/\/+$/u, '');
  return normalized === '/' ? '' : normalized;
}

function parseHref(href: string): URL {
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return new URL(href);
  }

  return new URL(ensureLeadingSlash(href), 'http://richie-router.local');
}

function stripBasePathFromPathname(pathname: string, basePath: string): string {
  if (!basePath) {
    return pathname;
  }

  if (pathname === basePath) {
    return '/';
  }

  return pathname.startsWith(`${basePath}/`) ? pathname.slice(basePath.length) || '/' : pathname;
}

function stripBasePathFromHref(href: string, basePath?: string): string {
  const normalizedBasePath = normalizeBasePath(basePath);
  if (!normalizedBasePath) {
    return href;
  }

  const url = parseHref(href);
  return `${stripBasePathFromPathname(url.pathname, normalizedBasePath)}${url.search}${url.hash}`;
}

function prependBasePathToPathname(pathname: string, basePath: string): string {
  if (!basePath) {
    return pathname;
  }

  return pathname === '/' ? basePath : `${basePath}${ensureLeadingSlash(pathname)}`;
}

function prependBasePathToHref(href: string, basePath?: string): string {
  const normalizedBasePath = normalizeBasePath(basePath);
  if (!normalizedBasePath) {
    return href;
  }

  const url = parseHref(href);
  return `${prependBasePathToPathname(url.pathname, normalizedBasePath)}${url.search}${url.hash}`;
}

function routeHasRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function routeHasInlineHead(route: AnyRoute): boolean {
  const headOption = route.options.head;
  return Boolean(headOption && typeof headOption !== 'string');
}

function matchesHaveInlineHead(matches: RouteMatch[]): boolean {
  return matches.some(match => routeHasInlineHead(match.route));
}

function resolveParamsInput<TParams extends Record<string, string>>(
  input: ParamsInput<TParams> | undefined,
  previous: TParams,
): Record<string, string> {
  if (input === undefined) {
    return previous;
  }

  return typeof input === 'function' ? input(previous) : input;
}

function resolveSearchInput<TSearch>(
  input: SearchInput<TSearch> | undefined,
  previous: TSearch,
): TSearch | Record<string, unknown> {
  if (input === true) {
    return previous;
  }

  if (input === undefined) {
    return {};
  }

  return typeof input === 'function'
    ? (input as (previous: TSearch) => TSearch)(previous)
    : input;
}

function attachRouteApi<TRoute extends AnyRoute>(route: TRoute): TRoute & RouteApiMethods<TRoute> {
  const api = route as TRoute & RouteApiMethods<TRoute>;

  api.useParams = () => useRouteMatchByFullPath(route.fullPath).params as ParamsOfRoute<TRoute>;
  api.useSearch = () => useRouteMatchByFullPath(route.fullPath).search as SearchOfRoute<TRoute>;
  api.useNavigate = () => useNavigate();
  api.useMatch = () => useRouteMatchByFullPath(route.fullPath) as MatchOfRoute<TRoute>;

  return api;
}

export function createFileRoute<TPath extends string>(path: TPath) {
  return function <TOptions extends RouteOptionsInput<TPath, SearchForRouteId<TPath>>>(
    options: TOptions,
  ): FileRouteInstance<
    TPath,
    SearchForRouteId<TPath>,
    unknown,
    TOptions extends { head: any } ? true : false
  > {
    const route = createRouteNode<
      TPath,
      NormalizeRouteId<TPath>,
      ResolveAllParams<TPath>,
      SearchForRouteId<TPath>
    >(
      path,
      options as CoreRouteOptions<TPath, SearchForRouteId<TPath>>,
    );

    return attachRouteApi(route) as FileRouteInstance<
      TPath,
      SearchForRouteId<TPath>,
      unknown,
      TOptions extends { head: any } ? true : false
    >;
  };
}

export function createRootRoute<TOptions extends RouteOptionsInput<'__root__', SearchForRouteId<'__root__'>>>(
  options: TOptions,
): FileRouteInstance<
  '__root__',
  SearchForRouteId<'__root__'>,
  unknown,
  TOptions extends { head: any } ? true : false
> {
  const route = createRouteNode<'__root__', '/', ResolveAllParams<'/'>, SearchForRouteId<'__root__'>>(
    '__root__',
    options as CoreRouteOptions<'__root__', SearchForRouteId<'__root__'>>,
    { isRoot: true },
  );

  return attachRouteApi(route) as FileRouteInstance<
    '__root__',
    SearchForRouteId<'__root__'>,
    unknown,
    TOptions extends { head: any } ? true : false
  >;
}

export class Router<TRouteTree extends AnyRoute> {
  public readonly routeTree: TRouteTree;
  public readonly history: RouterHistory;
  public readonly options: RouterOptions<TRouteTree>;
  public state: RouterState;
  public readonly routesByFullPath = new Map<string, AnyRoute>();
  public readonly routesByTo = new Map<string, AnyRoute>();
  private readonly listeners = new Set<() => void>();
  private readonly headCache = new Map<string, CachedHeadEntry>();
  private readonly parseSearch: (searchStr: string) => Record<string, unknown>;
  private readonly stringifySearch: (search: Record<string, unknown>) => string;
  private readonly basePath: string;
  private initialHeadSnapshot?: DehydratedHeadState;
  private started = false;
  private unsubscribeHistory?: () => void;

  constructor(options: RouterOptions<TRouteTree>) {
    this.routeTree = options.routeTree;
    this.options = options;
    this.history = options.history ?? (typeof window === 'undefined' ? createMemoryHistory() : createBrowserHistory());
    this.parseSearch = options.parseSearch ?? defaultParseSearch;
    this.stringifySearch = options.stringifySearch ?? defaultStringifySearch;
    this.basePath = normalizeBasePath(options.basePath);

    for (const route of collectRoutes(this.routeTree)) {
      this.routesByFullPath.set(route.fullPath, route);
    }

    for (const branch of collectBranches(this.routeTree)) {
      this.routesByTo.set(branch.leaf.to, branch.leaf);
    }

    const location = this.readLocation();
    const initialMatches = this.buildMatches(location);
    const rawHistoryHref = this.history.location.href;
    const initialHeadSnapshot = typeof window !== 'undefined' ? window.__RICHIE_ROUTER_HEAD__ : undefined;
    const hasMatchingInitialHeadSnapshot = Boolean(
      initialHeadSnapshot &&
      (initialHeadSnapshot.href === location.href || initialHeadSnapshot.href === rawHistoryHref),
    );
    const initialHead =
      hasMatchingInitialHeadSnapshot && initialHeadSnapshot
        ? initialHeadSnapshot.head
        : EMPTY_HEAD;

    if (
      hasMatchingInitialHeadSnapshot &&
      this.options.loadRouteHead === undefined &&
      initialHeadSnapshot?.routeHeads !== undefined
    ) {
      this.seedHeadCacheFromRouteHeads(initialMatches, initialHeadSnapshot.routeHeads);
    }

    if (typeof window !== 'undefined' && initialHeadSnapshot !== undefined) {
      delete window.__RICHIE_ROUTER_HEAD__;
    }

    this.initialHeadSnapshot = hasMatchingInitialHeadSnapshot ? initialHeadSnapshot : undefined;

    this.state = {
      status: 'loading',
      location,
      matches: initialMatches,
      head: initialHead,
      error: null,
    };
  }

  public getSnapshot = (): RouterState => this.state;

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.unsubscribeHistory = this.history.listen(() => {
      void this.handleHistoryChange();
    });

    if (this.state.status === 'loading') {
      void this.load();
    }
  }

  public dispose(): void {
    this.unsubscribeHistory?.();
    this.unsubscribeHistory = undefined;
    this.started = false;
  }

  public async load(options?: { request?: Request }): Promise<void> {
    const nextLocation = this.readLocation();
    const initialHeadSnapshot =
      this.initialHeadSnapshot?.href === nextLocation.href
        ? this.initialHeadSnapshot
        : undefined;
    this.initialHeadSnapshot = undefined;

    await this.commitLocation(nextLocation, {
      request: options?.request,
      replace: true,
      writeHistory: false,
      initialHeadSnapshot,
    });
  }

  public async navigate<TTo extends RoutePaths>(options: NavigateOptions<TTo>): Promise<void> {
    const location = this.buildLocation(options);

    await this.commitLocation(location, {
      replace: options.replace ?? false,
      writeHistory: true,
      resetScroll: options.resetScroll,
    });
  }

  public async preloadRoute<TTo extends RoutePaths>(options: NavigateOptions<TTo>): Promise<void> {
    const location = this.buildLocation(options);

    try {
      await this.resolveLocation(location);
    } catch {
      // Ignore preload failures.
    }
  }

  public async invalidate(): Promise<void> {
    this.headCache.clear();
    await this.load();
  }

  public buildHref<TTo extends RoutePaths>(options: NavigateOptions<TTo>): string {
    return prependBasePathToHref(this.buildLocationHref(options), this.basePath);
  }

  private buildLocation<TTo extends RoutePaths>(options: NavigateOptions<TTo>): ParsedLocation {
    return createParsedLocation(this.buildLocationHref(options), options.state ?? null, this.parseSearch);
  }

  private buildLocationHref<TTo extends RoutePaths>(options: NavigateOptions<TTo>): string {
    const targetRoute = this.routesByTo.get(options.to) ?? null;
    const fromMatch = options.from ? this.findMatchByTo(options.from) : null;
    const previousParams = (fromMatch?.params ?? {}) as ParamsForTo<TTo>;
    const previousSearch = (fromMatch?.search ?? this.state.location.search) as SearchForTo<TTo>;
    const params = resolveParamsInput(options.params as ParamsInput<ParamsForTo<TTo>> | undefined, previousParams);
    const path = buildPath(options.to, params);
    const searchValue = resolveSearchInput(options.search as SearchInput<SearchForTo<TTo>> | undefined, previousSearch);
    const search = this.stringifySearch(routeHasRecord(searchValue) ? searchValue : {});
    const hash = options.hash ? `#${options.hash.replace(/^#/, '')}` : '';
    const normalizedPath = this.applyTrailingSlash(path, targetRoute);

    return `${normalizedPath}${search}${hash}`;
  }

  private readLocation(): ParsedLocation {
    const location = this.history.location;
    return createParsedLocation(stripBasePathFromHref(location.href, this.basePath), location.state, this.parseSearch);
  }

  private applyTrailingSlash(pathname: string, route?: AnyRoute | null): string {
    const trailingSlash = this.options.trailingSlash ?? 'preserve';
    if (trailingSlash === 'preserve') {
      return pathname;
    }

    if (pathname === '/') {
      return '/';
    }

    if (trailingSlash === 'always') {
      return pathname.endsWith('/') ? pathname : `${pathname}/`;
    }

    if (route && route.fullPath.endsWith('/') && route.to === pathname) {
      return pathname;
    }

    return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private findMatchByTo(to: string): RouteMatch | null {
    const route = this.routesByTo.get(to);
    if (!route) {
      return null;
    }

    return this.state.matches.find(match => match.route.fullPath === route.fullPath) ?? null;
  }

  public buildMatches(location: ParsedLocation): InternalRouteMatch[] {
    const matched = matchRouteTree(this.routeTree, location.pathname) ?? [];
    const rawSearch = location.search as Record<string, unknown>;
    let accumulatedSearch: Record<string, unknown> = { ...rawSearch };

    return matched.map(({ route, params }) => {
      const nextSearch = this.resolveSearch(route, rawSearch);
      if (routeHasRecord(nextSearch)) {
        accumulatedSearch = {
          ...accumulatedSearch,
          ...nextSearch,
        };
      }

      return {
        id: route.fullPath,
        pathname: location.pathname,
        params,
        route,
        search: accumulatedSearch,
        to: route.to,
      };
    });
  }

  private resolveSearch(route: AnyRoute, rawSearch: Record<string, unknown>): unknown {
    const fromSchema = route.searchSchema ? route.searchSchema.parse(rawSearch) : {};
    if (routeHasRecord(fromSchema)) {
      return fromSchema;
    }

    return rawSearch;
  }

  public async resolveLocation(
    location: ParsedLocation,
    options?: { request?: Request; initialHeadSnapshot?: DehydratedHeadState },
  ): Promise<{ matches: InternalRouteMatch[]; head: HeadConfig; error: unknown }> {
    const matched = matchRouteTree(this.routeTree, location.pathname);
    if (!matched) {
      throw notFound();
    }

    const rawSearch = location.search as Record<string, unknown>;
    let accumulatedSearch: Record<string, unknown> = { ...rawSearch };
    const matches: InternalRouteMatch[] = [];

    for (const { route, params } of matched) {
      const nextSearch = this.resolveSearch(route, rawSearch);

      if (routeHasRecord(nextSearch)) {
        accumulatedSearch = {
          ...accumulatedSearch,
          ...nextSearch,
        };
      }

      if (route.options.beforeLoad) {
        await route.options.beforeLoad({
          location,
          params: params as never,
          search: accumulatedSearch as never,
          navigate: async (navigateOptions: {
            to: string;
            params?: Record<string, string>;
            search?: Record<string, unknown> | true;
            hash?: string;
            replace?: boolean;
            state?: Record<string, unknown>;
          }) => {
            await this.navigate(navigateOptions as unknown as NavigateOptions<RoutePaths>);
          },
          cause: this.state.location.pathname === location.pathname ? 'stay' : 'enter',
        });
      }

      matches.push({
        id: route.fullPath,
        pathname: location.pathname,
        params,
        route,
        search: accumulatedSearch,
        to: route.to,
      });
    }

    const head = await this.resolveLocationHead(matches, location, options?.request, options?.initialHeadSnapshot);
    return { matches, head, error: null };
  }

  private async resolveLocationHead(
    matches: InternalRouteMatch[],
    location: ParsedLocation,
    request?: Request,
    initialHeadSnapshot?: DehydratedHeadState,
  ): Promise<HeadConfig> {
    const resolvedHeadByRoute = new Map<string, HeadConfig>();
    const serverMatches = matches.filter(match => match.route.serverHead);

    if (serverMatches.length === 0) {
      return resolveHeadConfig(matches, resolvedHeadByRoute);
    }

    if (this.options.loadRouteHead !== undefined) {
      for (const match of serverMatches) {
        resolvedHeadByRoute.set(
          match.route.fullPath,
          await this.loadRouteHead(match.route, match.params, match.search, location, request),
        );
      }

      return resolveHeadConfig(matches, resolvedHeadByRoute);
    }

    if (
      initialHeadSnapshot?.href === location.href &&
      initialHeadSnapshot.routeHeads === undefined &&
      !matchesHaveInlineHead(matches)
    ) {
      return initialHeadSnapshot.head;
    }

    let needsDocumentHeadFetch = false;

    for (const match of serverMatches) {
      const cachedHead = this.getCachedRouteHead(match.route.fullPath, match.params, match.search);
      if (cachedHead) {
        resolvedHeadByRoute.set(match.route.fullPath, cachedHead);
        continue;
      }

      needsDocumentHeadFetch = true;
    }

    if (!needsDocumentHeadFetch) {
      return resolveHeadConfig(matches, resolvedHeadByRoute);
    }

    const documentHead = await this.fetchDocumentHead(location);
    if ((documentHead.routeHeads?.length ?? 0) === 0 && !matchesHaveInlineHead(matches)) {
      return documentHead.head;
    }

    const routeHeadsById = this.cacheRouteHeadsFromDocument(matches, documentHead.routeHeads ?? []);

    for (const match of serverMatches) {
      const responseHead = routeHeadsById.get(match.route.fullPath);
      if (responseHead) {
        resolvedHeadByRoute.set(match.route.fullPath, responseHead);
        continue;
      }

      const cachedHead = this.getCachedRouteHead(match.route.fullPath, match.params, match.search);
      if (cachedHead) {
        resolvedHeadByRoute.set(match.route.fullPath, cachedHead);
        continue;
      }

      const response = await this.fetchRouteHead(match.route, match.params, match.search);
      this.setRouteHeadCache(match.route.fullPath, match.params, match.search, response);
      resolvedHeadByRoute.set(match.route.fullPath, response.head);
    }

    return resolveHeadConfig(matches, resolvedHeadByRoute);
  }

  private getRouteHeadCacheKey(
    routeId: string,
    params: Record<string, string>,
    search: unknown,
  ): string {
    return JSON.stringify({
      routeId,
      params,
      search,
    });
  }

  private getCachedRouteHead(
    routeId: string,
    params: Record<string, string>,
    search: unknown,
  ): HeadConfig | null {
    const cached = this.headCache.get(this.getRouteHeadCacheKey(routeId, params, search));
    if (cached && cached.expiresAt > Date.now()) {
      return cached.head;
    }

    return null;
  }

  private setRouteHeadCache(
    routeId: string,
    params: Record<string, string>,
    search: unknown,
    response: { head: HeadConfig; staleTime?: number },
  ): void {
    this.headCache.set(this.getRouteHeadCacheKey(routeId, params, search), {
      head: response.head,
      expiresAt: Date.now() + (response.staleTime ?? 0),
    });
  }

  private seedHeadCacheFromRouteHeads(matches: InternalRouteMatch[], routeHeads: RouteHeadEntry[]): void {
    this.cacheRouteHeadsFromDocument(matches, routeHeads);
  }

  private cacheRouteHeadsFromDocument(
    matches: InternalRouteMatch[],
    routeHeads: RouteHeadEntry[],
  ): Map<string, HeadConfig> {
    const routeHeadsById = new Map(routeHeads.map(entry => [entry.routeId, entry] as const));
    const resolvedHeadByRoute = new Map<string, HeadConfig>();

    for (const match of matches) {
      if (!match.route.serverHead) {
        continue;
      }

      const entry = routeHeadsById.get(match.route.fullPath);
      if (!entry) {
        continue;
      }

      this.setRouteHeadCache(match.route.fullPath, match.params, match.search, entry);
      resolvedHeadByRoute.set(match.route.fullPath, entry.head);
    }

    return resolvedHeadByRoute;
  }

  private async loadRouteHead(
    route: AnyRoute,
    params: Record<string, string>,
    search: unknown,
    location: ParsedLocation,
    request?: Request,
  ): Promise<HeadConfig> {
    const cachedHead = this.getCachedRouteHead(route.fullPath, params, search);
    if (cachedHead) {
      return cachedHead;
    }

    const response =
      this.options.loadRouteHead !== undefined
        ? await this.options.loadRouteHead({
            route,
            routeId: route.fullPath,
            params,
            search,
            location,
            request,
          })
        : await this.fetchRouteHead(route, params, search);

    this.setRouteHeadCache(route.fullPath, params, search, response);

    return response.head;
  }

  private async fetchRouteHead(
    route: AnyRoute,
    params: Record<string, string>,
    search: unknown,
  ): Promise<{ head: HeadConfig; staleTime?: number }> {
    const basePath = this.options.headBasePath ?? prependBasePathToHref('/head-api', this.basePath);
    const searchParams = new URLSearchParams({
      routeId: route.fullPath,
      params: JSON.stringify(params),
      search: JSON.stringify(search),
    });
    const response = await fetch(`${basePath}?${searchParams.toString()}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw notFound();
      }

      throw new Error(`Failed to resolve server head for route "${route.fullPath}"`);
    }

    return (await response.json()) as { head: HeadConfig; staleTime?: number };
  }

  private async fetchDocumentHead(
    location: ParsedLocation,
  ): Promise<DocumentHeadResponsePayload> {
    const basePath = this.options.headBasePath ?? prependBasePathToHref('/head-api', this.basePath);
    const searchParams = new URLSearchParams({
      href: prependBasePathToHref(location.href, this.basePath),
    });
    const response = await fetch(`${basePath}?${searchParams.toString()}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw notFound();
      }

      throw new Error(`Failed to resolve server head for location "${location.href}"`);
    }

    return (await response.json()) as DocumentHeadResponsePayload;
  }

  private async commitLocation(
    location: ParsedLocation,
    options: {
      replace: boolean;
      writeHistory: boolean;
      resetScroll?: boolean;
      request?: Request;
      initialHeadSnapshot?: DehydratedHeadState;
    },
  ): Promise<void> {
    this.state = {
      ...this.state,
      status: 'loading',
      location,
    };
    this.notify();

    try {
      const resolved = await this.resolveLocation(location, {
        request: options.request,
        initialHeadSnapshot: options.initialHeadSnapshot,
      });
      const historyHref = prependBasePathToHref(location.href, this.basePath);

      if (options.writeHistory) {
        if (options.replace) {
          this.history.replace(historyHref, location.state);
        } else {
          this.history.push(historyHref, location.state);
        }
      }

      this.state = {
        status: 'idle',
        location,
        matches: resolved.matches,
        head: resolved.head,
        error: resolved.error,
      };
      this.notify();
      this.restoreScroll(options.resetScroll);
    } catch (error) {
      if (isRedirect(error)) {
        await this.navigate({
          ...(error.options as unknown as NavigateOptions<RoutePaths>),
          replace: error.options.replace ?? true,
        });
        return;
      }

      const errorMatches = this.buildMatches(location);
      const historyHref = prependBasePathToHref(location.href, this.basePath);

      if (options.writeHistory) {
        if (options.replace) {
          this.history.replace(historyHref, location.state);
        } else {
          this.history.push(historyHref, location.state);
        }
      }

      this.state = {
        status: 'idle',
        location,
        matches: errorMatches,
        head: resolveHeadConfig(errorMatches),
        error,
      };
      this.notify();
    }
  }

  private restoreScroll(resetScroll: boolean | undefined): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (!this.options.scrollRestoration || resetScroll === false) {
      return;
    }

    const selectors = this.options.scrollToTopSelectors ?? [];
    if (selectors.length === 0) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      return;
    }

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element instanceof HTMLElement) {
        element.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      }
    }
  }

  private async handleHistoryChange(): Promise<void> {
    const nextLocation = this.readLocation();
    await this.commitLocation(nextLocation, {
      replace: true,
      writeHistory: false,
    });
  }
}

export function createRouter<TRouteTree extends AnyRoute>(options: RouterOptions<TRouteTree>): Router<TRouteTree> {
  return new Router(options);
}

function useRouterContext(): Router<AnyRoute> {
  const router = React.useContext(RouterContext);
  if (!router) {
    throw new Error('Richie Router hooks must be used inside <RouterProvider>.');
  }

  return router;
}

function useRouterStateContext(): RouterState {
  const state = React.useContext(RouterStateContext);
  if (!state) {
    throw new Error('Richie Router hooks must be used inside <RouterProvider>.');
  }

  return state;
}

function useRouteMatchByFullPath(fullPath: string): RouteMatch {
  const state = useRouterStateContext();
  const currentRenderedMatch = React.useContext(MatchContext);
  return (
    state.matches.find(match => match.route.fullPath === fullPath) ??
    (currentRenderedMatch?.route.fullPath === fullPath ? currentRenderedMatch : null) ??
    (() => {
      throw new Error(`No active match found for "${fullPath}".`);
    })()
  );
}

function resolveHookMatch(from?: string): RouteMatch {
  const router = useRouterContext();
  const state = useRouterStateContext();
  const currentRenderedMatch = React.useContext(MatchContext);

  if (!from) {
    return currentRenderedMatch ?? state.matches.at(-1) ?? (() => {
      throw new Error('No active route match is available.');
    })();
  }

  const targetRoute = router.routesByTo.get(from);
  if (!targetRoute) {
    throw new Error(`Unknown route path "${from}".`);
  }

  return state.matches.find(match => match.route.fullPath === targetRoute.fullPath) ?? (() => {
    throw new Error(`The route "${from}" is not part of the current match set.`);
  })();
}

function createManagedHeadElements(head: HeadConfig): HTMLElement[] {
  if (typeof document === 'undefined') {
    return [];
  }

  const elements: HTMLElement[] = [];
  const managed = (element: HTMLElement) => {
    element.setAttribute(MANAGED_HEAD_ATTRIBUTE, 'true');
    return element;
  };
  const setAttributes = (
    element: HTMLElement,
    attributes: Record<string, string | boolean | undefined>,
  ) => {
    for (const [key, value] of Object.entries(attributes)) {
      if (value === undefined || value === false) {
        continue;
      }

      if (value === true) {
        element.setAttribute(key, '');
        continue;
      }

      element.setAttribute(key, value);
    }
  };

  for (const element of head) {
    if (element.tag === 'title') {
      continue;
    }

    if (element.tag === 'meta') {
      const tag = managed(document.createElement('meta'));
      if ('charset' in element) {
        tag.setAttribute('charset', element.charset);
      } else if ('name' in element) {
        tag.setAttribute('name', element.name);
        tag.setAttribute('content', element.content);
      } else if ('property' in element) {
        tag.setAttribute('property', element.property);
        tag.setAttribute('content', element.content);
      } else {
        tag.setAttribute('http-equiv', element.httpEquiv);
        tag.setAttribute('content', element.content);
      }
      elements.push(tag);
      continue;
    }

    if (element.tag === 'link') {
      const tag = managed(document.createElement('link'));
      setAttributes(tag, {
        rel: element.rel,
        href: element.href,
        type: element.type,
        media: element.media,
        sizes: element.sizes,
        crossorigin: element.crossorigin,
      });
      elements.push(tag);
      continue;
    }

    if (element.tag === 'style') {
      const tag = managed(document.createElement('style'));
      if (element.media) {
        tag.setAttribute('media', element.media);
      }
      tag.textContent = element.children;
      elements.push(tag);
      continue;
    }

    if (element.tag === 'script') {
      const tag = managed(document.createElement('script')) as HTMLScriptElement;
      if (element.src) {
        tag.setAttribute('src', element.src);
      }
      if (element.type) {
        tag.setAttribute('type', element.type);
      }
      if (element.async) {
        tag.async = true;
      }
      if (element.defer) {
        tag.defer = true;
      }
      if (element.children) {
        tag.textContent = element.children;
      }
      elements.push(tag);
      continue;
    }

    if (element.tag === 'base') {
      const tag = managed(document.createElement('base'));
      tag.setAttribute('href', element.href);
      if (element.target) {
        tag.setAttribute('target', element.target);
      }
      elements.push(tag);
      continue;
    }

    const tag = managed(document.createElement(element.name));
    setAttributes(tag, element.attrs ?? {});
    if (element.children) {
      tag.textContent = element.children;
    }
    elements.push(tag);
  }

  return elements;
}

function reconcileDocumentHead(head: HeadConfig): void {
  if (typeof document === 'undefined') {
    return;
  }

  const title = [...head]
    .reverse()
    .find(element => element.tag === 'title');

  if (title && title.tag === 'title') {
    document.title = title.children;
  }

  for (const element of Array.from(document.head.querySelectorAll(`[${MANAGED_HEAD_ATTRIBUTE}]`))) {
    element.remove();
  }

  const elements = createManagedHeadElements(head);
  for (const element of elements) {
    document.head.appendChild(element);
  }
}

function RenderMatches({ matches, index }: { matches: RouteMatch[]; index: number }): React.ReactNode {
  const match = matches[index];
  if (!match) {
    return null;
  }

  const Component = match.route.options.component as React.ComponentType | undefined;
  const outlet = <RenderMatches matches={matches} index={index + 1} />;

  return (
    <MatchContext.Provider value={match}>
      <OutletContext.Provider value={outlet}>
        {Component ? <Component /> : outlet}
      </OutletContext.Provider>
    </MatchContext.Provider>
  );
}

function renderError(
  error: unknown,
  matches: RouteMatch[],
  router: Router<AnyRoute>,
): React.ReactNode {
  const reversed = [...matches].reverse();

  if (isNotFound(error)) {
    const NotFoundComponent =
      reversed.find(match => match.route.options.notFoundComponent)?.route.options.notFoundComponent ??
      router.options.defaultNotFoundComponent;

    if (NotFoundComponent) {
      return React.createElement(NotFoundComponent as React.ComponentType);
    }

    return <div>Not Found</div>;
  }

  const ErrorComponent =
    reversed.find(match => match.route.options.errorComponent)?.route.options.errorComponent ??
    router.options.defaultErrorComponent;

  if (ErrorComponent) {
    return React.createElement(ErrorComponent as React.ComponentType<any>, {
      error,
      reset: () => {
        void router.invalidate();
      },
    });
  }

  return <pre>{error instanceof Error ? error.message : 'Unknown routing error'}</pre>;
}

export function RouterProvider({ router }: { router: RegisteredRouter }): React.ReactElement {
  const snapshot = React.useSyncExternalStore(router.subscribe, router.getSnapshot, router.getSnapshot);

  React.useEffect(() => {
    router.start();
    return () => {
      router.dispose();
    };
  }, [router]);

  React.useEffect(() => {
    reconcileDocumentHead(snapshot.head);
  }, [snapshot.head]);

  const content = snapshot.error
    ? renderError(snapshot.error, snapshot.matches, router as Router<AnyRoute>)
    : <RenderMatches matches={snapshot.matches} index={0} />;

  return (
    <RouterContext.Provider value={router as Router<AnyRoute>}>
      <RouterStateContext.Provider value={snapshot}>
        {content}
      </RouterStateContext.Provider>
    </RouterContext.Provider>
  );
}

export function Outlet(): React.ReactNode {
  return React.useContext(OutletContext);
}

export function useRouter(): RegisteredRouter {
  return useRouterContext() as RegisteredRouter;
}

export function useMatches(): RouteMatch[] {
  return useRouterStateContext().matches;
}

export function useMatch<TFrom extends RoutePaths>(options?: {
  from?: TFrom;
}): MatchOfRoute<RouteById<TFrom>> {
  return resolveHookMatch(options?.from) as MatchOfRoute<RouteById<TFrom>>;
}

export function useParams<TFrom extends RoutePaths>(options?: { from?: TFrom }): ParamsOfRoute<RouteById<TFrom>> {
  return resolveHookMatch(options?.from).params as ParamsOfRoute<RouteById<TFrom>>;
}

export function useSearch<TFrom extends RoutePaths>(options?: { from?: TFrom }): SearchOfRoute<RouteById<TFrom>> {
  return resolveHookMatch(options?.from).search as SearchOfRoute<RouteById<TFrom>>;
}

export function useNavigate(): NavigateFn {
  const router = useRouterContext();
  return React.useCallback(async options => {
    await router.navigate(options);
  }, [router]);
}

export function useLocation(): ParsedLocation {
  return useRouterStateContext().location;
}

export function useRouterState<TSelection>(options: { select: Selector<TSelection> }): TSelection {
  const router = useRouterContext();
  return React.useSyncExternalStore(
    router.subscribe,
    () => options.select(router.getSnapshot()),
    () => options.select(router.getSnapshot()),
  );
}

export interface BlockerState {
  status: 'idle' | 'blocked';
  next: ParsedLocation | null;
  proceed(): void;
  reset(): void;
}

export function useBlocker(options: {
  shouldBlockFn?: (ctx: { current: ParsedLocation; next: ParsedLocation | null }) => boolean;
  withResolver?: boolean;
  enableBeforeUnload?: boolean;
}): BlockerState {
  const current = useLocation();
  const [next, setNext] = React.useState<ParsedLocation | null>(null);

  React.useEffect(() => {
    if (!options.enableBeforeUnload || typeof window === 'undefined') {
      return;
    }

    const listener = (event: BeforeUnloadEvent) => {
      if (!options.shouldBlockFn?.({ current, next })) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', listener);
    return () => window.removeEventListener('beforeunload', listener);
  }, [current, next, options]);

  return {
    status: next ? 'blocked' : 'idle',
    next,
    proceed() {
      setNext(null);
    },
    reset() {
      setNext(null);
    },
  };
}

export function Block(): null {
  return null;
}

export function useElementScrollRestoration(): { ref: React.RefCallback<HTMLElement> } {
  return {
    ref: () => {},
  };
}

function useResolvedLink<TTo extends RoutePaths>(props: NavigateOptions<TTo>) {
  const router = useRouterContext();
  const href = router.buildHref(props);
  const location = useLocation();
  const pathOnly = stripBasePathFromHref(href, router.options.basePath).split(/[?#]/u)[0] ?? href;
  const isActive = pathOnly === location.pathname;
  return { href, isActive, router };
}

const LinkComponent = React.forwardRef(function LinkInner<TTo extends RoutePaths>(
  props: LinkProps<TTo>,
  ref: React.ForwardedRef<HTMLAnchorElement>,
) {
  const allProps = props as LinkProps<RoutePaths>;
  const {
    to,
    from,
    params,
    search,
    hash,
    replace,
    resetScroll,
    state,
    mask,
    ignoreBlocker,
    activeProps,
    children,
    onClick,
    onMouseEnter,
    onFocus,
    preload,
    ...anchorProps
  } = allProps;
  const navigation = {
    to,
    from,
    params,
    search,
    hash,
    replace,
    resetScroll,
    state,
    mask,
    ignoreBlocker,
  } as unknown as NavigateOptions<TTo>;
  const { href, isActive, router } = useResolvedLink(navigation);
  const preloadMode = preload ?? router.options.defaultPreload;
  const preloadDelay = router.options.defaultPreloadDelay ?? 50;
  const preloadTimeout = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (preloadMode !== 'render') {
      return;
    }

    void router.preloadRoute(navigation);
  }, [navigation, preloadMode, router]);

  const schedulePreload = React.useCallback(() => {
    if (preloadMode !== 'intent') {
      return;
    }

    preloadTimeout.current = window.setTimeout(() => {
      void router.preloadRoute(navigation);
    }, preloadDelay);
  }, [navigation, preloadDelay, preloadMode, router]);

  const cancelPreload = React.useCallback(() => {
    if (preloadTimeout.current !== null) {
      window.clearTimeout(preloadTimeout.current);
      preloadTimeout.current = null;
    }
  }, []);

  const renderedChildren = typeof children === 'function' ? children({ isActive }) : children;

  return (
    <a
      {...anchorProps}
      {...(isActive ? activeProps : undefined)}
      ref={ref}
      href={href}
      onClick={event => {
        onClick?.(event);

        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        ) {
          return;
        }

        event.preventDefault();
        void router.navigate(navigation);
      }}
      onMouseEnter={event => {
        onMouseEnter?.(event);
        if (typeof window !== 'undefined') {
          schedulePreload();
        }
      }}
      onMouseLeave={cancelPreload}
      onFocus={event => {
        onFocus?.(event);
        if (typeof window !== 'undefined') {
          schedulePreload();
        }
      }}
      onBlur={cancelPreload}
    >
      {renderedChildren}
    </a>
  );
}) as <TTo extends RoutePaths>(
  props: LinkProps<TTo> & { ref?: React.Ref<HTMLAnchorElement> },
) => React.ReactElement;

export const Link = LinkComponent;

export function createLink<TProps extends { href?: string; children?: React.ReactNode }>(
  Component: React.ComponentType<TProps>,
) {
  return function CreatedLink<TTo extends RoutePaths>(
    props: LinkProps<TTo> & Omit<TProps, keyof LinkProps<TTo>>,
  ): React.ReactElement {
    const allProps = props as LinkProps<RoutePaths> & Omit<TProps, keyof LinkProps<RoutePaths>>;
    const {
      to,
      from,
      params,
      search,
      hash,
      replace,
      resetScroll,
      state,
      mask,
      ignoreBlocker,
      activeProps,
      children,
      preload,
      ...componentProps
    } = allProps;
    const navigation = {
      to,
      from,
      params,
      search,
      hash,
      replace,
      resetScroll,
      state,
      mask,
      ignoreBlocker,
    } as unknown as NavigateOptions<TTo>;
    const { href, isActive, router } = useResolvedLink(navigation);
    const renderedChildren = typeof children === 'function' ? children({ isActive }) : children;

    React.useEffect(() => {
      if (preload !== 'render') {
        return;
      }

      void router.preloadRoute(navigation);
    }, [navigation, preload, router]);

    return (
      <Component
        {...(componentProps as unknown as TProps)}
        {...(isActive ? activeProps : undefined)}
        href={href}
      >
        {renderedChildren}
      </Component>
    );
  };
}

export function linkOptions<TTo extends RoutePaths>(options: NavigateOptions<TTo>): NavigateOptions<TTo> {
  return options;
}

export function getRouteApi<TTo extends RoutePaths>(to: TTo) {
  return {
    useParams: () => useParams({ from: to }),
    useSearch: () => useSearch({ from: to }),
    useMatch: () => useMatch({ from: to }),
  };
}

export function createRouteMask<TMask extends { to: string }>(mask: TMask): TMask {
  return mask;
}

export {
  redirect,
  notFound,
  isRedirect,
  isNotFound,
  createBrowserHistory,
  createHashHistory,
  createMemoryHistory,
};

export type { MemoryHistoryOptions };
