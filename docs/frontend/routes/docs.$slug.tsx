import React from 'react';
import { ErrorResponse } from '@richie-rpc/client';
import { createFileRoute } from '@richie-router/react';
import rehypeHighlight from 'rehype-highlight';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { docsClient } from '../api';
import type { DocumentRecord } from '../../shared/contract';

function stripDuplicateLeadingHeading(markdown: string, title: string): string {
  const match = markdown.match(/^#\s+(.+?)\n+/u);
  if (!match) {
    return markdown;
  }

  return match[1]?.trim() === title ? markdown.slice(match[0].length) : markdown;
}

export const Route = createFileRoute('/docs/$slug')({
  component: DocumentPage,
  head: 'document-page',
});

function DocumentPage() {
  const { slug } = Route.useParams();
  const [document, setDocument] = React.useState<DocumentRecord | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadDocument() {
      try {
        const response = await docsClient.getDocument({
          params: { slug },
        });

        if (cancelled) return;
        React.startTransition(() => {
          setDocument(response.payload);
          setError(null);
        });
      } catch (nextError) {
        if (cancelled) return;
        const message =
          nextError instanceof ErrorResponse
            ? String((nextError.payload as { error?: string }).error ?? 'Document not found')
            : nextError instanceof Error
              ? nextError.message
              : 'Failed to load document';

        React.startTransition(() => {
          setDocument(null);
          setError(message);
        });
      }
    }

    void loadDocument();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return <p>{error}</p>;
  }

  if (!document) {
    return <p>Loading document...</p>;
  }

  const renderedMarkdown = stripDuplicateLeadingHeading(document.markdown, document.title);

  return (
    <article style={{ display: 'grid', gap: '1rem' }}>
      <div>
        <p style={{ textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
          {document.slug}
        </p>
        <h1 style={{ margin: 0 }}>{document.title}</h1>
      </div>
      <p style={{ opacity: 0.75 }}>{document.excerpt}</p>
      <div
        className="docs-markdown"
        style={{
          padding: '1.5rem',
          borderRadius: '1.25rem',
          background: 'rgba(255, 251, 245, 0.92)',
          border: '1px solid rgba(27, 23, 19, 0.12)',
        }}
      >
        <ReactMarkdown
          rehypePlugins={[rehypeHighlight]}
          remarkPlugins={[remarkGfm]}
          components={{
            a(props) {
              const href = typeof props.href === 'string' ? props.href : '';
              const isExternal = /^https?:\/\//u.test(href);
              return (
                <a
                  {...props}
                  target={isExternal ? '_blank' : undefined}
                  rel={isExternal ? 'noreferrer' : undefined}
                />
              );
            },
          }}
        >
          {renderedMarkdown}
        </ReactMarkdown>
      </div>
    </article>
  );
}
