import { defineContract, Status } from '@richie-rpc/core';
import { z } from 'zod';

export const documentSummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  excerpt: z.string(),
  wordCount: z.number(),
  headings: z.array(z.string()),
});

export const documentSchema = documentSummarySchema.extend({
  markdown: z.string(),
});

const errorSchema = z.object({
  error: z.string(),
});

export const docsContract = defineContract({
  listDocuments: {
    type: 'standard',
    method: 'GET',
    path: '/api/documents',
    responses: {
      [Status.OK]: z.object({
        documents: z.array(documentSummarySchema),
      }),
    },
  },
  getDocument: {
    type: 'standard',
    method: 'GET',
    path: '/api/documents/:slug',
    params: z.object({
      slug: z.string(),
    }),
    responses: {
      [Status.OK]: documentSchema,
    },
    errorResponses: {
      [Status.NotFound]: errorSchema,
    },
  },
  searchDocuments: {
    type: 'standard',
    method: 'GET',
    path: '/api/search',
    query: z.object({
      q: z.string().min(1),
    }),
    responses: {
      [Status.OK]: z.object({
        query: z.string(),
        results: z.array(
          documentSummarySchema.extend({
            matches: z.number(),
          }),
        ),
      }),
    },
  },
});

export type DocumentSummary = z.infer<typeof documentSummarySchema>;
export type DocumentRecord = z.infer<typeof documentSchema>;
export type SearchResult = DocumentSummary & {
  matches: number;
};
