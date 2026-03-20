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

export interface HandleRequestOptions<TRouteManifest extends AnyRoute, TRouterSchema extends RouterSchemaShape> {
  routeManifest: TRouteManifest;
  headTags: DefinedHeadTags<TRouteManifest, TRouterSchema>;
  html: HtmlOptions;
  basePath?: string;
  headBasePath?: string;
  routeBasePath?: string;
}

export interface HandleHeadTagRequestOptions<TRouteManifest extends AnyRoute, TRouterSchema extends RouterSchemaShape> {
  headTags: DefinedHeadTags<TRouteManifest, TRouterSchema>;
  headBasePath?: string;
}

export interface HandleRequestResult {
  matched: boolean;
  response: Response;
}

const HEAD_PLACEHOLDER = '<!--richie-router-head-->';
const MANAGED_HEAD_ATTRIBUTE = 'data-richie-router-head';

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
): Promise<string> {
  const template = html.template;

  if (typeof template === 'function') {
    return await template(ctx);
  }

  if (!template.includes(HEAD_PLACEHOLDER)) {
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
  const headBasePath = options.headBasePath ?? '/head-api';

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

export async function handleRequest<TRouteManifest extends AnyRoute, TRouterSchema extends RouterSchemaShape>(
  request: Request,
  options: HandleRequestOptions<TRouteManifest, TRouterSchema>,
): Promise<HandleRequestResult> {
  const url = new URL(request.url);
  const basePath = normalizeBasePath(options.basePath ?? options.routeBasePath);
  const headBasePath = options.headBasePath ?? prependBasePathToPathname('/head-api', basePath);
  const handledHeadTagRequest = await handleHeadTagRequest(request, {
    headTags: options.headTags,
    headBasePath,
  });

  if (handledHeadTagRequest.matched) {
    return handledHeadTagRequest;
  }

  const strippedPathname = stripBasePathFromPathname(url.pathname, basePath);

  if (strippedPathname === null) {
    return {
      matched: false,
      response: new Response('Not Found', { status: 404 }),
    };
  }

  const location = createParsedLocation(`${strippedPathname}${url.search}${url.hash}`, null, defaultParseSearch);
  const matches = buildMatches(options.routeManifest, location);

  if (matches.length === 0) {
    return {
      matched: false,
      response: new Response('Not Found', { status: 404 }),
    };
  }

  try {
    const head = await resolveMatchedHead(request, options.headTags, matches);
    const headHtml = serializeHeadConfig(head, {
      managedAttribute: MANAGED_HEAD_ATTRIBUTE,
    });
    const richieRouterHead = `${headHtml}${createHeadSnapshotScript(location.href, head)}`;
    const html = await renderTemplate(options.html, {
      request,
      richieRouterHead,
      head,
    });

    return {
      matched: true,
      response: new Response(html, {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
      }),
    };
  } catch (error) {
    if (isRedirect(error)) {
      const redirectPath = prependBasePathToPathname(
        buildPath(error.options.to, error.options.params ?? {}),
        basePath,
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
