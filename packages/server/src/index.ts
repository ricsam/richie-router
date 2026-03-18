import {
  buildPath,
  createParsedLocation,
  defaultParseSearch,
  defaultStringifySearch,
  isNotFound,
  isRedirect,
  matchRouteTree,
  resolveHeadConfig,
  serializeHeadConfig,
  type AnyRoute,
  type HeadConfig,
  type HeadTagSchemaShape,
  type InferHeadTagSearchSchema,
  type ParsedLocation,
  type RouteMatch,
} from '@richie-router/core';

export interface HeadTagContext<TSearch> {
  request: Request;
  params: Record<string, string>;
  search: TSearch;
}

export interface HeadTagDefinition<TSearch> {
  staleTime?: number;
  head: (ctx: HeadTagContext<TSearch>) => Promise<HeadConfig> | HeadConfig;
}

export interface DefinedHeadTags<
  TRouteManifest extends AnyRoute,
  THeadTagSchema extends HeadTagSchemaShape,
  TDefinitions extends Partial<{
    [THeadTagName in keyof THeadTagSchema]: HeadTagDefinition<
      InferHeadTagSearchSchema<THeadTagSchema, THeadTagName>
    >;
  }>,
> {
  routeManifest: TRouteManifest;
  headTagSchema: THeadTagSchema;
  definitions: TDefinitions;
}

export function defineHeadTags<
  TRouteManifest extends AnyRoute,
  THeadTagSchema extends HeadTagSchemaShape,
  TDefinitions extends Partial<{
    [THeadTagName in keyof THeadTagSchema]: HeadTagDefinition<
      InferHeadTagSearchSchema<THeadTagSchema, THeadTagName>
    >;
  }>,
>(
  routeManifest: TRouteManifest,
  headTagSchema: THeadTagSchema,
  definitions: TDefinitions,
): DefinedHeadTags<TRouteManifest, THeadTagSchema, TDefinitions> {
  return {
    routeManifest,
    headTagSchema,
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

export interface HandleRequestOptions<
  TRouteManifest extends AnyRoute,
  THeadTagSchema extends HeadTagSchemaShape,
  TDefinitions extends Partial<Record<keyof THeadTagSchema, HeadTagDefinition<any>>>,
> {
  routeManifest: TRouteManifest;
  headTags: DefinedHeadTags<TRouteManifest, THeadTagSchema, TDefinitions>;
  html: HtmlOptions;
  headBasePath?: string;
  routeBasePath?: string;
}

export interface HandleRequestResult {
  matched: boolean;
  response: Response;
}

const HEAD_PLACEHOLDER = '<!--richie-router-head-->';
const MANAGED_HEAD_ATTRIBUTE = 'data-richie-router-head';

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

async function executeHeadTag<
  TRouteManifest extends AnyRoute,
  THeadTagSchema extends HeadTagSchemaShape,
  TDefinitions extends Partial<Record<keyof THeadTagSchema, HeadTagDefinition<any>>>,
>(
  request: Request,
  headTags: DefinedHeadTags<TRouteManifest, THeadTagSchema, TDefinitions>,
  headTagName: string,
  params: Record<string, string>,
  rawSearch: unknown,
): Promise<{ head: HeadConfig; staleTime?: number }> {
  const definition = headTags.definitions[headTagName as keyof TDefinitions] as HeadTagDefinition<any> | undefined;
  const schemaEntry = headTags.headTagSchema[headTagName];

  if (!definition) {
    throw new Error(`Unknown head tag "${headTagName}".`);
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

async function resolveMatchedHead<
  TRouteManifest extends AnyRoute,
  THeadTagSchema extends HeadTagSchemaShape,
  TDefinitions extends Partial<Record<keyof THeadTagSchema, HeadTagDefinition<any>>>,
>(
  request: Request,
  headTags: DefinedHeadTags<TRouteManifest, THeadTagSchema, TDefinitions>,
  matches: RouteMatch[],
): Promise<HeadConfig> {
  const resolvedHeadByRoute = new Map<string, HeadConfig>();

  for (const match of matches) {
    const headOption = match.route.options.head;
    if (typeof headOption !== 'string') {
      continue;
    }

    const result = await executeHeadTag(request, headTags, headOption, match.params, match.search);
    resolvedHeadByRoute.set(match.route.fullPath, result.head);
  }

  return resolveHeadConfig(matches, resolvedHeadByRoute);
}

export async function handleRequest<
  TRouteManifest extends AnyRoute,
  THeadTagSchema extends HeadTagSchemaShape,
  TDefinitions extends Partial<Record<keyof THeadTagSchema, HeadTagDefinition<any>>>,
>(
  request: Request,
  options: HandleRequestOptions<TRouteManifest, THeadTagSchema, TDefinitions>,
): Promise<HandleRequestResult> {
  const url = new URL(request.url);
  const headBasePath = options.headBasePath ?? '/head-api';
  const routeBasePath = options.routeBasePath ?? '/';

  if (url.pathname.startsWith(`${headBasePath}/`)) {
    const headTagName = decodeURIComponent(url.pathname.slice(headBasePath.length + 1));
    const params = JSON.parse(url.searchParams.get('params') ?? '{}') as Record<string, string>;
    const search = JSON.parse(url.searchParams.get('search') ?? '{}');

    try {
      const result = await executeHeadTag(request, options.headTags, headTagName, params, search);
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

  if (!url.pathname.startsWith(routeBasePath)) {
    return {
      matched: false,
      response: new Response('Not Found', { status: 404 }),
    };
  }

  const location = createParsedLocation(`${url.pathname}${url.search}${url.hash}`, null, defaultParseSearch);
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
      const redirectPath = buildPath(error.options.to, error.options.params ?? {});
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
