import {
  buildPath,
  createParsedLocation,
  defaultParseSearch,
  defaultStringifySearch,
  type ResolveAllParamsForRouteId,
  type RouteIdsWithServerHead,
  type RouterSchemaShape,
  type InferRouterSearchSchema,
  isNotFound,
  isRedirect,
  matchPathname,
  matchRouteTree,
  resolveHeadConfig,
  serializeHeadConfig,
  type AnyRoute,
  type HeadConfig,
  type ParsedLocation,
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

export type HeadTagDefinitions<TRouterSchema extends RouterSchemaShape> = {
  [TRouteId in RouteIdsWithServerHead<TRouterSchema>]: HeadTagDefinition<
    ResolveAllParamsForRouteId<TRouteId>,
    InferRouterSearchSchema<TRouterSchema, TRouteId>
  >;
};

export interface DefinedHeadTags<TRouteManifest extends AnyRoute, TRouterSchema extends RouterSchemaShape> {
  routeManifest: TRouteManifest;
  routerSchema: TRouterSchema;
  definitions: HeadTagDefinitions<TRouterSchema>;
}

export function defineHeadTags<TRouteManifest extends AnyRoute, TRouterSchema extends RouterSchemaShape>(
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
}

interface BaseMatchSpaRequestOptions {
  basePath?: string;
}

export type MatchSpaRequestOptions =
  | ({ routeManifest: AnyRoute } & BaseMatchSpaRequestOptions)
  | ({ spaRoutesManifest: SpaRoutesManifest } & BaseMatchSpaRequestOptions);

interface DocumentResponseOptions {
  html: HtmlOptions;
  headers?: HeadersInit;
}

export type HandleSpaRequestOptions = MatchSpaRequestOptions & DocumentResponseOptions;

export interface HandleRequestOptions<TRouteManifest extends AnyRoute, TRouterSchema extends RouterSchemaShape> {
  routeManifest: TRouteManifest;
  headTags: DefinedHeadTags<TRouteManifest, TRouterSchema>;
  html: HtmlOptions;
  basePath?: string;
  headers?: HeadersInit;
  headBasePath?: string;
}

export interface HandleHeadTagRequestOptions<TRouteManifest extends AnyRoute, TRouterSchema extends RouterSchemaShape> {
  headTags: DefinedHeadTags<TRouteManifest, TRouterSchema>;
  basePath?: string;
  headBasePath?: string;
}

export interface HandleRequestResult {
  matched: boolean;
  response: Response;
}

const HEAD_PLACEHOLDER = '<!--richie-router-head-->';
const MANAGED_HEAD_ATTRIBUTE = 'data-richie-router-head';
const EMPTY_HEAD: HeadConfig = { meta: [], links: [], styles: [], scripts: [] };

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

function createHeadSnapshotScript(href: string, head: HeadConfig): string {
  const payload = JSON.stringify({ href, head }).replaceAll('</script>', '<\\/script>');
  return `<script ${MANAGED_HEAD_ATTRIBUTE}="true">window.__RICHIE_ROUTER_HEAD__=${payload}</script>`;
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
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {}),
    },
  });
}

function notFoundResult(): HandleRequestResult {
  return {
    matched: false,
    response: new Response('Not Found', { status: 404 }),
  };
}

function htmlResponse(html: string, headers?: HeadersInit): Response {
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      ...(headers ?? {}),
    },
  });
}

function resolveDocumentRequest(
  request: Request,
  basePathOption?: string,
): { basePath: string; location: ParsedLocation } | null {
  const url = new URL(request.url);
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

function matchesSpaLocation(options: MatchSpaRequestOptions, location: ParsedLocation): boolean {
  if ('routeManifest' in options) {
    return buildMatches(options.routeManifest, location).length > 0;
  }

  return resolveSpaRoutes(options.spaRoutesManifest).some(route => matchPathname(route, location.pathname) !== null);
}

export function matchesSpaRequest(
  request: Request,
  options: MatchSpaRequestOptions,
): boolean {
  const documentRequest = resolveDocumentRequest(request, options.basePath);
  if (documentRequest === null) {
    return false;
  }

  return matchesSpaLocation(options, documentRequest.location);
}

async function executeHeadTag<TRouteManifest extends AnyRoute, TRouterSchema extends RouterSchemaShape>(
  request: Request,
  headTags: DefinedHeadTags<TRouteManifest, TRouterSchema>,
  routeId: string,
  params: Record<string, string>,
  rawSearch: unknown,
): Promise<{ head: HeadConfig; staleTime?: number }> {
  const definition = headTags.definitions[routeId as keyof typeof headTags.definitions] as
    | HeadTagDefinition<Record<string, string>, unknown>
    | undefined;
  const schemaEntry = headTags.routerSchema[routeId];

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

async function resolveMatchedHead<TRouteManifest extends AnyRoute, TRouterSchema extends RouterSchemaShape>(
  request: Request,
  headTags: DefinedHeadTags<TRouteManifest, TRouterSchema>,
  matches: RouteMatch[],
): Promise<HeadConfig> {
  const resolvedHeadByRoute = new Map<string, HeadConfig>();

  for (const match of matches) {
    if (!match.route.serverHead) {
      continue;
    }

    const result = await executeHeadTag(request, headTags, match.route.fullPath, match.params, match.search);
    resolvedHeadByRoute.set(match.route.fullPath, result.head);
  }

  return resolveHeadConfig(matches, resolvedHeadByRoute);
}

export async function handleHeadTagRequest<TRouteManifest extends AnyRoute, TRouterSchema extends RouterSchemaShape>(
  request: Request,
  options: HandleHeadTagRequestOptions<TRouteManifest, TRouterSchema>,
): Promise<HandleRequestResult> {
  const url = new URL(request.url);
  const basePath = normalizeBasePath(options.basePath);
  const headBasePath = options.headBasePath ?? prependBasePathToPathname('/head-api', basePath);

  if (url.pathname !== headBasePath) {
    return {
      matched: false,
      response: new Response('Not Found', { status: 404 }),
    };
  }

  const routeId = url.searchParams.get('routeId');
  if (!routeId) {
    return {
      matched: true,
      response: jsonResponse({ message: 'Missing routeId' }, { status: 400 }),
    };
  }

  const params = JSON.parse(url.searchParams.get('params') ?? '{}') as Record<string, string>;
  const search = JSON.parse(url.searchParams.get('search') ?? '{}');

  try {
    const result = await executeHeadTag(request, options.headTags, routeId, params, search);
    return {
      matched: true,
      response: jsonResponse(result),
    };
  } catch (error) {
    if (error instanceof Response) {
      return {
        matched: true,
        response: error,
      };
    }

    if (isNotFound(error)) {
      return {
        matched: true,
        response: jsonResponse({ message: 'Not Found' }, { status: 404 }),
      };
    }

    throw error;
  }
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

export async function handleRequest<TRouteManifest extends AnyRoute, TRouterSchema extends RouterSchemaShape>(
  request: Request,
  options: HandleRequestOptions<TRouteManifest, TRouterSchema>,
): Promise<HandleRequestResult> {
  const basePath = normalizeBasePath(options.basePath);
  const handledHeadTagRequest = await handleHeadTagRequest(request, {
    headTags: options.headTags,
    basePath,
    headBasePath: options.headBasePath,
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
    const head = await resolveMatchedHead(request, options.headTags, matches);
    const headHtml = serializeHeadConfig(head, {
      managedAttribute: MANAGED_HEAD_ATTRIBUTE,
    });
    const richieRouterHead = `${headHtml}${createHeadSnapshotScript(documentRequest.location.href, head)}`;
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
