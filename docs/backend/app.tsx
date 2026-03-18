import path from 'node:path';
import { createDocsResponse, generateOpenAPISpec } from '@richie-rpc/openapi';
import { RouteNotFoundError, ValidationError, createRouter, Status } from '@richie-rpc/server';
import { defineHeadTags, handleRequest } from '@richie-router/server';
import indexHtml from '../frontend/index.html';
import { docsContract } from '../shared/contract';
import { headTagSchema } from '../shared/head-tag-schema';
import { routeManifest } from '../shared/route-manifest.gen';

const TEMPLATE_PATH = '/__richie-router-template';

type DocumentRecord = {
  slug: string;
  title: string;
  excerpt: string;
  markdown: string;
  wordCount: number;
  headings: string[];
};

const markdownSources = [
  {
    slug: 'creating-a-router',
    filePath: path.resolve('docs/content/creating-a-router.md'),
  },
  {
    slug: 'type-safety',
    filePath: path.resolve('docs/content/type-safety.md'),
  },
  {
    slug: 'seo',
    filePath: path.resolve('docs/content/seo.md'),
  },
  {
    slug: 'authenticated-routes',
    filePath: path.resolve('docs/content/authenticated-routes.md'),
  },
  {
    slug: 'scroll-restoration',
    filePath: path.resolve('docs/content/scroll-restoration.md'),
  },
  {
    slug: 'custom-search-param-serialization',
    filePath: path.resolve('docs/content/custom-search-param-serialization.md'),
  },
  {
    slug: 'navigation-blocking',
    filePath: path.resolve('docs/content/navigation-blocking.md'),
  },
  {
    slug: 'not-found-errors',
    filePath: path.resolve('docs/content/not-found-errors.md'),
  },
  {
    slug: 'route-masking',
    filePath: path.resolve('docs/content/route-masking.md'),
  },
  {
    slug: 'preloading',
    filePath: path.resolve('docs/content/preloading.md'),
  },
  {
    slug: 'type-utilities',
    filePath: path.resolve('docs/content/type-utilities.md'),
  },
  {
    slug: 'custom-link',
    filePath: path.resolve('docs/content/custom-link.md'),
  },
  {
    slug: 'link-options',
    filePath: path.resolve('docs/content/link-options.md'),
  },
  {
    slug: 'search-params',
    filePath: path.resolve('docs/content/search-params.md'),
  },
  {
    slug: 'path-params',
    filePath: path.resolve('docs/content/path-params.md'),
  },
  {
    slug: 'navigation',
    filePath: path.resolve('docs/content/navigation.md'),
  },
  {
    slug: 'outlets',
    filePath: path.resolve('docs/content/outlets.md'),
  },
  {
    slug: 'readme',
    title: 'README',
    filePath: path.resolve('README.md'),
  },
  {
    slug: 'specification',
    title: '@richie-router/ Specification',
    filePath: path.resolve('richie-router-spec.md'),
  },
] as const;

function extractTitle(markdown: string): string | null {
  const firstHeading = markdown
    .split('\n')
    .find(line => line.startsWith('#'));

  if (!firstHeading) {
    return null;
  }

  return firstHeading.replace(/^#+\s*/u, '').trim() || null;
}

function summarizeMarkdown(markdown: string, title?: string | null): { excerpt: string; wordCount: number; headings: string[] } {
  const headings = markdown
    .split('\n')
    .filter(line => line.startsWith('#'))
    .map(line => line.replace(/^#+\s*/u, '').trim())
    .filter(Boolean);
  const blocks = markdown
    .replace(/^#+\s*/gmu, '')
    .split(/\n\s*\n/u)
    .map(block => block.trim())
    .filter(Boolean);
  const excerpt = blocks.find(block => block !== (title ?? null)) ?? 'No excerpt available.';
  const wordCount = markdown.trim().split(/\s+/u).filter(Boolean).length;

  return { excerpt, wordCount, headings };
}

async function loadDocuments(): Promise<DocumentRecord[]> {
  return Promise.all(
    markdownSources.map(async entry => {
      const markdown = await Bun.file(entry.filePath).text();
      const title = entry.title ?? extractTitle(markdown) ?? entry.slug;
      const summary = summarizeMarkdown(markdown, title);
      return {
        slug: entry.slug,
        title,
        markdown,
        excerpt: summary.excerpt,
        wordCount: summary.wordCount,
        headings: summary.headings,
      };
    }),
  );
}

const documents = await loadDocuments();
const documentsBySlug = new Map(documents.map(document => [document.slug, document]));

function searchDocuments(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return documents
    .map(document => {
      const haystack = `${document.title}\n${document.excerpt}\n${document.markdown}`.toLowerCase();
      const matches = haystack.split(normalized).length - 1;
      return {
        ...document,
        matches,
      };
    })
    .filter(document => document.matches > 0)
    .sort((left, right) => right.matches - left.matches);
}

const rpcRouter = createRouter(docsContract, {
  listDocuments: async () => ({
    status: Status.OK,
    body: {
      documents: documents.map(({ markdown: _markdown, ...document }) => document),
    },
  }),
  getDocument: async ({ params }) => {
    const document = documentsBySlug.get(params.slug);
    if (!document) {
      return {
        status: Status.NotFound,
        body: {
          error: 'Document not found',
        },
      };
    }

    return {
      status: Status.OK,
      body: document,
    };
  },
  searchDocuments: async ({ query }) => ({
    status: Status.OK,
    body: {
      query: query.q,
      results: searchDocuments(query.q).map(({ markdown: _markdown, ...document }) => document),
    },
  }),
});

const openAPISpec = generateOpenAPISpec(docsContract, {
  info: {
    title: '@richie-router/ Docs API',
    version: '0.1.0',
  },
});

const docsReferenceHtml = createDocsResponse('/openapi.json', {
  title: '@richie-router/ Docs API',
});

export const headTags = defineHeadTags(routeManifest, headTagSchema, {
  'docs-shell': {
    staleTime: 60_000,
    head: async () => ({
      meta: [
        { title: '@richie-router/ Docs' },
        { name: 'description', content: 'Search and browse the real markdown docs in this repository.' },
      ],
    }),
  },
  'document-page': {
    staleTime: 60_000,
    head: async ({ params }) => {
      const document = documentsBySlug.get(params.slug);
      if (!document) {
        throw new Response('Not Found', { status: 404 });
      }

      return {
        meta: [
          { title: `${document.title} | @richie-router/ Docs` },
          { name: 'description', content: document.excerpt },
        ],
      };
    },
  },
  'docs-search': {
    staleTime: 10_000,
    head: async ({ search }) => ({
      meta: [
        { title: search.q ? `Search: ${search.q} | @richie-router/ Docs` : 'Search | @richie-router/ Docs' },
        {
          name: 'description',
          content: search.q
            ? `Search results for "${search.q}" in the repository markdown files.`
            : 'Search across the markdown files in this repository.',
        },
      ],
    }),
  },
});

export function startDocsServer(options?: { port?: number }) {
  return Bun.serve({
    port: options?.port ?? 3001,
    routes: {
      [TEMPLATE_PATH]: indexHtml,
    },
    async fetch(request) {
      const url = new URL(request.url);

      if (url.pathname === '/openapi.json') {
        return Response.json(openAPISpec);
      }

      if (url.pathname === '/reference') {
        return docsReferenceHtml;
      }

      if (url.pathname.startsWith('/api')) {
        try {
          return await rpcRouter.handle(request);
        } catch (error) {
          if (error instanceof ValidationError) {
            return Response.json(
              { error: 'Validation Error', field: error.field, issues: error.zodError.issues },
              { status: 400 },
            );
          }

          if (error instanceof RouteNotFoundError) {
            return Response.json({ error: 'Not Found' }, { status: 404 });
          }

          return Response.json({ error: 'Internal Server Error' }, { status: 500 });
        }
      }

      const templateUrl = new URL(request.url);
      templateUrl.pathname = TEMPLATE_PATH;

      const htmlTemplate = await (await fetch(templateUrl)).text();

      const handled = await handleRequest(request, {
        routeManifest,
        headTags,
        headBasePath: '/head-api',
        html: {
          template: htmlTemplate,
        },
      });

      if (handled.matched) {
        return handled.response;
      }

      return new Response('Not Found', { status: 404 });
    },
    development: process.env.NODE_ENV === 'production' ? false : {
      console: true,
      hmr: true,
    },
  });
}
