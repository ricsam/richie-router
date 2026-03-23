import {
  buildPath,
  createParsedLocation,
  defaultParseSearch,
  defaultStringifySearch,
  getRouteSchemaEntry,
  getRouterSchemaHostedRouting,
  type ResolveAllParamsForRouteId,
  type RouteIdsWithServerHead,
  type AnyRouterSchema,
  type InferRouterSearchSchema,
  isNotFound,
  isRedirect,
  matchPathname,
  matchRouteTree,
  resolveHeadConfig,
  resolveHostedRoutingConfig,
  serializeHeadConfig,
  type AnyRoute,
  type HeadConfig,
  type HostedRoutingConfig,
  type ParsedLocation,
  type RouteHeadEntry,
  type RouteMatch,
} from '@richie-router/core';

export interface HeadTagContext<TParams extends Record<string, string>, TSearch> {
  request: Request;
  params: TParams;
  search: TSearch;
}

export interface HeadTagDefinition<TParams extends Record<string, string>, TSearch> {
  staleTime?: number;
  head: (ctx: HeadTagContext<TParams, TSearch>) => Promise<HeadConfig> | HeadConfig;
}

export type HeadTagDefinitions<TRouterSchema extends AnyRouterSchema> = {
  [TRouteId in RouteIdsWithServerHead<TRouterSchema>]: HeadTagDefinition<
    ResolveAllParamsForRouteId<TRouteId>,
    InferRouterSearchSchema<TRouterSchema, TRouteId>
  >;
};

export interface DefinedHeadTags<TRouteManifest extends AnyRoute, TRouterSchema extends AnyRouterSchema> {
  routeManifest: TRouteManifest;
  routerSchema: TRouterSchema;
  definitions: HeadTagDefinitions<TRouterSchema>;
}

export function defineHeadTags<TRouteManifest extends AnyRoute, TRouterSchema extends AnyRouterSchema>(
  routeManifest: TRouteManifest,
  routerSchema: TRouterSchema,
  definitions: HeadTagDefinitions<TRouterSchema>,
): DefinedHeadTags<TRouteManifest, TRouterSchema> {
  return {
    routeManifest,
    routerSchema,
    definitions,
  };
}

export interface HtmlOptions {
  template:
    | string
    | ((ctx: {
        request: Request;
        richieRouterHead: string;
        head: HeadConfig;
      }) => string | Promise<string>);
}

export interface SpaRoutesManifestRoute {
  id: string;
  to: string;
  parentId: string | null;
  isRoot: boolean;
}

export interface SpaRoutesManifest {
  routes?: SpaRoutesManifestRoute[];
  spaRoutes: string[];
  hostedRouting?: HostedRoutingConfig;
}

interface BaseMatchSpaPathOptions {
  basePath?: string;
}

export type MatchSpaPathOptions =
  | ({ routeManifest: AnyRoute } & BaseMatchSpaPathOptions)
  | ({ spaRoutesManifest: SpaRoutesManifest } & BaseMatchSpaPathOptions);

interface DocumentResponseOptions {
  html: HtmlOptions;
  headers?: HeadersInit;
}

export type HandleSpaRequestOptions = MatchSpaPathOptions & DocumentResponseOptions;

export interface HandleRequestOptions<TRouteManifest extends AnyRoute, TRouterSchema extends AnyRouterSchema> {
  routeManifest: TRouteManifest;
  headTags: DefinedHeadTags<TRouteManifest, TRouterSchema>;
  html: HtmlOptions;
  basePath?: string;
  headers?: HeadersInit;
}

export interface HandleHeadTagRequestOptions<TRouteManifest extends AnyRoute, TRouterSchema extends AnyRouterSchema> {
  headTags: DefinedHeadTags<TRouteManifest, TRouterSchema>;
  basePath?: string;
}

export interface HandleRequestResult {
  matched: boolean;
  response: Response;
}

export interface RouteHeadResponsePayload {
  head: HeadConfig;
  staleTime?: number;
}

export interface DocumentHeadResponsePayload extends RouteHeadResponsePayload {
  href: string;
  richieRouterHead: string;
  routeHeads: RouteHeadEntry[];
}

const HEAD_PLACEHOLDER = '<!--richie-router-head-->';
const MANAGED_HEAD_ATTRIBUTE = 'data-richie-router-head';
const HEAD_RESPONSE_KIND_HEADER = 'x-richie-router-head';
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

function stripBasePathFromPathname(pathname: string, basePath: string): string | null {
  if (!basePath) {
    return pathname;
  }

  if (pathname === basePath) {
    return '/';
  }

  if (pathname.startsWith(`${basePath}/`)) {
    return pathname.slice(basePath.length) || '/';
  }

  return null;
}

function prependBasePathToPathname(pathname: string, basePath: string): string {
  if (!basePath) {
    return pathname;
  }

  return pathname === '/' ? basePath : `${basePath}${ensureLeadingSlash(pathname)}`;
}

function routeHasRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function createHeadSnapshotScript(href: string, head: HeadConfig, routeHeads: RouteHeadEntry[]): string {
  const payload = JSON.stringify({ href, head, routeHeads }).replaceAll('</script>', '<\\/script>');
  return `<script ${MANAGED_HEAD_ATTRIBUTE}="true">window.__RICHIE_ROUTER_HEAD__=${payload}</script>`;
}

function createRichieRouterHead(href: string, head: HeadConfig, routeHeads: RouteHeadEntry[]): string {
  const headHtml = serializeHeadConfig(head, {
    managedAttribute: MANAGED_HEAD_ATTRIBUTE,
  });
  return `${headHtml}${createHeadSnapshotScript(href, head, routeHeads)}`;
}

async function renderTemplate(
  html: HtmlOptions,
  ctx: {
    request: Request;
    richieRouterHead: string;
    head: HeadConfig;
  },
  options?: {
    requireHeadPlaceholder?: boolean;
  },
): Promise<string> {
  const template = html.template;

  if (typeof template === 'function') {
    return await template(ctx);
  }

  if (!template.includes(HEAD_PLACEHOLDER)) {
    if (options?.requireHeadPlaceholder === false) {
      return template;
    }

    throw new Error(`HTML template is missing required Richie Router placeholder: ${HEAD_PLACEHOLDER}`);
  }

  return template.replace(HEAD_PLACEHOLDER, ctx.richieRouterHead);
}

function jsonResponse(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json; charset=utf-8');
  }

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

function notFoundResult(): HandleRequestResult {
  return {
    matched: false,
    response: new Response('Not Found', { status: 404 }),
  };
}

function htmlResponse(html: string, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  if (!responseHeaders.has('content-type')) {
    responseHeaders.set('content-type', 'text/html; charset=utf-8');
  }

  return new Response(html, {
    status: 200,
    headers: responseHeaders,
  });
}

function withResponseHeaders(response: Response, headersToSet: HeadersInit): Response {
  const headers = new Headers(response.headers);
  new Headers(headersToSet).forEach((value, key) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function formatHeadCacheControl(staleTime?: number): string {
  if (staleTime === undefined) {
    return 'private, no-store';
  }

  return `private, max-age=${Math.max(0, Math.floor(staleTime / 1000))}`;
}

function createHeadResponseHeaders(
  kind: 'route' | 'document',
  staleTime?: number,
  headers?: HeadersInit,
): Headers {
  const responseHeaders = new Headers(headers);
  responseHeaders.set(HEAD_RESPONSE_KIND_HEADER, kind);
  responseHeaders.set('cache-control', formatHeadCacheControl(staleTime));
  return responseHeaders;
}

function resolveDocumentRequest(
  request: Request,
  basePathOption?: string,
): { basePath: string; location: ParsedLocation } | null {
  return resolveDocumentPath(request.url, basePathOption);
}

function resolveDocumentPath(
  path: string,
  basePathOption?: string,
): { basePath: string; location: ParsedLocation } | null {
  const url = new URL(path, 'http://richie-router.local');
  const basePath = normalizeBasePath(basePathOption);
  const strippedPathname = stripBasePathFromPathname(url.pathname, basePath);

  if (strippedPathname === null) {
    return null;
  }

  return {
    basePath,
    location: createParsedLocation(`${strippedPathname}${url.search}${url.hash}`, null, defaultParseSearch),
  };
}

async function renderDocumentResponse(
  request: Request,
  html: HtmlOptions,
  richieRouterHead: string,
  head: HeadConfig,
  options?: {
    headers?: HeadersInit;
    requireHeadPlaceholder?: boolean;
  },
): Promise<HandleRequestResult> {
  const template = await renderTemplate(html, {
    request,
    richieRouterHead,
    head,
  }, {
    requireHeadPlaceholder: options?.requireHeadPlaceholder,
  });

  return {
    matched: true,
    response: htmlResponse(template, options?.headers),
  };
}

function resolveSearch(route: AnyRoute, rawSearch: Record<string, unknown>): unknown {
  const fromSchema = route.searchSchema ? route.searchSchema.parse(rawSearch) : {};
  if (routeHasRecord(fromSchema)) {
    return fromSchema;
  }

  return rawSearch;
}

function buildMatches(routeManifest: AnyRoute, location: ParsedLocation): RouteMatch[] {
  const matched = matchRouteTree(routeManifest, location.pathname);
  if (!matched) {
    return [];
  }

  const rawSearch = location.search as Record<string, unknown>;
  let accumulatedSearch: Record<string, unknown> = { ...rawSearch };

  return matched.map(({ route, params }) => {
    const nextSearch = resolveSearch(route, rawSearch);
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

function resolveSpaRoutes(spaRoutesManifest: SpaRoutesManifest): string[] {
  if (!routeHasRecord(spaRoutesManifest)) {
    throw new Error('Invalid spaRoutesManifest: expected an object.');
  }

  const { spaRoutes } = spaRoutesManifest;
  if (!Array.isArray(spaRoutes) || spaRoutes.some(route => typeof route !== 'string')) {
    throw new Error('Invalid spaRoutesManifest: expected "spaRoutes" to be an array of strings.');
  }

  return spaRoutes;
}

function resolveHostedRouting(options: MatchSpaPathOptions): HostedRoutingConfig {
  if ('routeManifest' in options) {
    return resolveHostedRoutingConfig(options.routeManifest.hostedRouting);
  }

  return resolveHostedRoutingConfig(options.spaRoutesManifest.hostedRouting);
}

function matchesPassthroughLocation(options: MatchSpaPathOptions, location: ParsedLocation): boolean {
  return resolveHostedRouting(options).passthrough.some(route => matchPathname(route, location.pathname) !== null);
}

function matchesSpaLocation(options: MatchSpaPathOptions, location: ParsedLocation): boolean {
  if ('routeManifest' in options) {
    return buildMatches(options.routeManifest, location).length > 0;
  }

  return resolveSpaRoutes(options.spaRoutesManifest).some(route => matchPathname(route, location.pathname) !== null);
}

export function matchesSpaPath(
  path: string,
  options: MatchSpaPathOptions,
): boolean {
  const documentRequest = resolveDocumentPath(path, options.basePath);
  if (documentRequest === null) {
    return false;
  }

  return matchesSpaLocation(options, documentRequest.location);
}

export function matchesPassthroughPath(
  path: string,
  options: MatchSpaPathOptions,
): boolean {
  const documentRequest = resolveDocumentPath(path, options.basePath);
  if (documentRequest === null) {
    return false;
  }

  return matchesPassthroughLocation(options, documentRequest.location);
}

async function executeHeadTag<TRouteManifest extends AnyRoute, TRouterSchema extends AnyRouterSchema>(
  request: Request,
  headTags: DefinedHeadTags<TRouteManifest, TRouterSchema>,
  routeId: string,
  params: Record<string, string>,
  rawSearch: unknown,
): Promise<{ head: HeadConfig; staleTime?: number }> {
  const definition = headTags.definitions[routeId as keyof typeof headTags.definitions] as
    | HeadTagDefinition<Record<string, string>, unknown>
    | undefined;
  const schemaEntry = getRouteSchemaEntry(headTags.routerSchema, routeId);

  if (!definition) {
    throw new Error(`Unknown server head route "${routeId}".`);
  }

  const search = schemaEntry?.searchSchema ? schemaEntry.searchSchema.parse(rawSearch) : rawSearch;
  const head = await definition.head({
    request,
    params,
    search,
  });

  return {
    head,
    staleTime: definition.staleTime,
  };
}

async function resolveMatchedHead<TRouteManifest extends AnyRoute, TRouterSchema extends AnyRouterSchema>(
  request: Request,
  headTags: DefinedHeadTags<TRouteManifest, TRouterSchema>,
  matches: RouteMatch[],
): Promise<RouteHeadResponsePayload & { routeHeads: RouteHeadEntry[] }> {
  const resolvedHeadByRoute = new Map<string, HeadConfig>();
  const routeHeads: RouteHeadEntry[] = [];
  let staleTime: number | undefined;

  for (const match of matches) {
    if (!match.route.serverHead) {
      continue;
    }

    const result = await executeHeadTag(request, headTags, match.route.fullPath, match.params, match.search);
    resolvedHeadByRoute.set(match.route.fullPath, result.head);
    routeHeads.push({
      routeId: match.route.fullPath,
      head: result.head,
      staleTime: result.staleTime,
    });

    if (result.staleTime !== undefined) {
      staleTime = staleTime === undefined ? result.staleTime : Math.min(staleTime, result.staleTime);
    }
  }

  return {
    head: resolveHeadConfig(matches, resolvedHeadByRoute),
    routeHeads,
    staleTime,
  };
}

function createDocumentHeadRequest(sourceRequest: Request, href: string): Request {
  const requestUrl = new URL(sourceRequest.url);
  const targetUrl = new URL(href, requestUrl);

  return new Request(targetUrl.toString(), {
    method: 'GET',
    headers: sourceRequest.headers,
  });
}

async function handleDocumentHeadRequest<TRouteManifest extends AnyRoute, TRouterSchema extends AnyRouterSchema>(
  request: Request,
  options: HandleHeadTagRequestOptions<TRouteManifest, TRouterSchema>,
  href: string,
): Promise<HandleRequestResult> {
  const documentRequest = createDocumentHeadRequest(request, href);
  const resolvedDocumentRequest = resolveDocumentRequest(documentRequest, options.basePath);

  if (resolvedDocumentRequest === null) {
    return {
      matched: true,
      response: jsonResponse({ message: 'Not Found' }, {
        status: 404,
        headers: createHeadResponseHeaders('document'),
      }),
    };
  }

  try {
    const matches = buildMatches(options.headTags.routeManifest, resolvedDocumentRequest.location);

    if (matches.length === 0) {
      return {
        matched: true,
        response: jsonResponse({ message: 'Not Found' }, {
          status: 404,
          headers: createHeadResponseHeaders('document'),
        }),
      };
    }

    const { head, routeHeads, staleTime } = await resolveMatchedHead(documentRequest, options.headTags, matches);

    return {
      matched: true,
      response: jsonResponse({
        href: resolvedDocumentRequest.location.href,
        head,
        routeHeads,
        staleTime,
        richieRouterHead: createRichieRouterHead(resolvedDocumentRequest.location.href, head, routeHeads),
      } satisfies DocumentHeadResponsePayload, {
        headers: createHeadResponseHeaders('document', staleTime),
      }),
    };
  } catch (error) {
    if (isRedirect(error)) {
      const redirectPath = prependBasePathToPathname(
        buildPath(error.options.to, error.options.params ?? {}),
        resolvedDocumentRequest.basePath,
      );
      const redirectSearch = defaultStringifySearch(
        error.options.search === true ? {} : error.options.search ?? {},
      );
      const redirectHash = error.options.hash ? `#${error.options.hash.replace(/^#/, '')}` : '';
      const redirectUrl = `${redirectPath}${redirectSearch}${redirectHash}`;

      return {
        matched: true,
        response: new Response(null, {
          status: error.options.replace ? 307 : 302,
          headers: createHeadResponseHeaders('document', undefined, {
            location: redirectUrl,
          }),
        }),
      };
    }

    if (error instanceof Response) {
      return {
        matched: true,
        response: withResponseHeaders(error, createHeadResponseHeaders('document')),
      };
    }

    if (isNotFound(error)) {
      return {
        matched: true,
        response: jsonResponse({ message: 'Not Found' }, {
          status: 404,
          headers: createHeadResponseHeaders('document'),
        }),
      };
    }

    throw error;
  }
}

export async function handleHeadRequest<TRouteManifest extends AnyRoute, TRouterSchema extends AnyRouterSchema>(
  request: Request,
  options: HandleHeadTagRequestOptions<TRouteManifest, TRouterSchema>,
): Promise<HandleRequestResult> {
  const url = new URL(request.url);
  const basePath = normalizeBasePath(options.basePath);
  const headBasePath = prependBasePathToPathname(
    getRouterSchemaHostedRouting(options.headTags.routerSchema).headBasePath,
    basePath,
  );

  if (url.pathname !== headBasePath) {
    return {
      matched: false,
      response: new Response('Not Found', { status: 404 }),
    };
  }

  const href = url.searchParams.get('href');
  if (href !== null) {
    return await handleDocumentHeadRequest(request, {
      ...options,
      basePath,
    }, href);
  }

  const routeId = url.searchParams.get('routeId');
  if (!routeId) {
    return {
      matched: true,
      response: jsonResponse({ message: 'Missing routeId' }, {
        status: 400,
        headers: createHeadResponseHeaders('route'),
      }),
    };
  }

  const params = JSON.parse(url.searchParams.get('params') ?? '{}') as Record<string, string>;
  const search = JSON.parse(url.searchParams.get('search') ?? '{}');

  try {
    const result = await executeHeadTag(request, options.headTags, routeId, params, search);
    return {
      matched: true,
      response: jsonResponse(result satisfies RouteHeadResponsePayload, {
        headers: createHeadResponseHeaders('route', result.staleTime),
      }),
    };
  } catch (error) {
    if (error instanceof Response) {
      return {
        matched: true,
        response: withResponseHeaders(error, createHeadResponseHeaders('route')),
      };
    }

    if (isNotFound(error)) {
      return {
        matched: true,
        response: jsonResponse({ message: 'Not Found' }, {
          status: 404,
          headers: createHeadResponseHeaders('route'),
        }),
      };
    }

    throw error;
  }
}

export async function handleHeadTagRequest<TRouteManifest extends AnyRoute, TRouterSchema extends AnyRouterSchema>(
  request: Request,
  options: HandleHeadTagRequestOptions<TRouteManifest, TRouterSchema>,
): Promise<HandleRequestResult> {
  return await handleHeadRequest(request, options);
}

export async function handleSpaRequest(
  request: Request,
  options: HandleSpaRequestOptions,
): Promise<HandleRequestResult> {
  const documentRequest = resolveDocumentRequest(request, options.basePath);

  if (documentRequest === null) {
    return notFoundResult();
  }

  if (!matchesSpaLocation(options, documentRequest.location)) {
    return notFoundResult();
  }

  return await renderDocumentResponse(request, options.html, '', EMPTY_HEAD, {
    headers: options.headers,
    requireHeadPlaceholder: false,
  });
}

export async function handleRequest<TRouteManifest extends AnyRoute, TRouterSchema extends AnyRouterSchema>(
  request: Request,
  options: HandleRequestOptions<TRouteManifest, TRouterSchema>,
): Promise<HandleRequestResult> {
  const basePath = normalizeBasePath(options.basePath);
  const handledHeadTagRequest = await handleHeadTagRequest(request, {
    headTags: options.headTags,
    basePath,
  });

  if (handledHeadTagRequest.matched) {
    return handledHeadTagRequest;
  }

  const documentRequest = resolveDocumentRequest(request, basePath);
  if (documentRequest === null) {
    return notFoundResult();
  }

  const matches = buildMatches(options.routeManifest, documentRequest.location);

  if (matches.length === 0) {
    return notFoundResult();
  }

  try {
    const { head, routeHeads } = await resolveMatchedHead(request, options.headTags, matches);
    const richieRouterHead = createRichieRouterHead(documentRequest.location.href, head, routeHeads);
    return await renderDocumentResponse(request, options.html, richieRouterHead, head, {
      headers: options.headers,
    });
  } catch (error) {
    if (isRedirect(error)) {
      const redirectPath = prependBasePathToPathname(
        buildPath(error.options.to, error.options.params ?? {}),
        documentRequest.basePath,
      );
      const redirectSearch = defaultStringifySearch(
        error.options.search === true ? {} : error.options.search ?? {},
      );
      const redirectHash = error.options.hash ? `#${error.options.hash.replace(/^#/, '')}` : '';
      const redirectUrl = `${redirectPath}${redirectSearch}${redirectHash}`;

      return {
        matched: true,
        response: new Response(null, {
          status: error.options.replace ? 307 : 302,
          headers: {
            location: redirectUrl,
          },
        }),
      };
    }

    if (error instanceof Response) {
      return {
        matched: true,
        response: error,
      };
    }

    if (isNotFound(error)) {
      return {
        matched: true,
        response: new Response('Not Found', { status: 404 }),
      };
    }

    throw error;
  }
}
