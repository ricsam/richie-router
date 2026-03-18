import React from 'react';
import { Link, createFileRoute } from '@richie-router/react';
import { docsClient } from '../api';
import type { DocumentSummary } from '../../shared/contract';

export const Route = createFileRoute('/')({
  component: IndexPage,
});

function IndexPage() {
  const [documents, setDocuments] = React.useState<DocumentSummary[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadDocuments() {
      try {
        const response = await docsClient.listDocuments({});
        if (cancelled) return;
        React.startTransition(() => {
          setDocuments(response.payload.documents);
          setError(null);
        });
      } catch (nextError) {
        if (cancelled) return;
        React.startTransition(() => {
          setError(nextError instanceof Error ? nextError.message : 'Failed to load documents');
        });
      }
    }

    void loadDocuments();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section style={{ display: 'grid', gap: '1.5rem' }}>
      <div>
        <p style={{ textTransform: 'uppercase', letterSpacing: '0.18em', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
          @richie-router/
        </p>
        <h1 style={{ margin: 0, fontSize: 'clamp(2.2rem, 5vw, 4rem)' }}>Browse @richie-router/ guides, reference docs, and examples.</h1>
      </div>
      {error ? <p>{error}</p> : null}
      <div style={{ display: 'grid', gap: '1rem' }}>
        {documents.map(document => (
          <article
            key={document.slug}
            style={{
              border: '1px solid rgba(27, 23, 19, 0.12)',
              borderRadius: '1rem',
              padding: '1rem 1.25rem',
              background: 'rgba(255, 251, 245, 0.9)',
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              <Link to="/docs/$slug" params={{ slug: document.slug }}>
                {document.title}
              </Link>
            </h2>
            <p>{document.excerpt}</p>
            <p style={{ marginBottom: 0, opacity: 0.65 }}>
              {document.wordCount} words, {document.headings.length} headings
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
