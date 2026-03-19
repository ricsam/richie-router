import React from 'react';
import { Link, createFileRoute } from '@richie-router/react';
import { docsClient } from '../api';
import { DocsSearchForm } from '../search-form';
import type { SearchResult } from '../../shared/contract';

export const Route = createFileRoute('/search')({
  component: SearchPage,
});

function SearchPage() {
  const search = Route.useSearch();
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const query = search.q.trim();

  React.useEffect(() => {
    let cancelled = false;

    async function runSearch() {
      if (!query) {
        React.startTransition(() => {
          setResults([]);
          setError(null);
          setIsLoading(false);
        });
        return;
      }

      setIsLoading(true);

      try {
        const response = await docsClient.searchDocuments({
          query: { q: query },
        });

        if (cancelled) return;
        React.startTransition(() => {
          setResults(response.payload.results);
          setError(null);
          setIsLoading(false);
        });
      } catch (nextError) {
        if (cancelled) return;
        React.startTransition(() => {
          setResults([]);
          setError(nextError instanceof Error ? nextError.message : 'Search failed');
          setIsLoading(false);
        });
      }
    }

    void runSearch();
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div>
        <h1 style={{ marginBottom: '0.25rem' }}>Search</h1>
        <p style={{ margin: 0, opacity: 0.75 }}>Search through titles, excerpts, headings, and markdown body text.</p>
      </div>
      <div
        className="docs-search-panel"
        style={{
          border: '1px solid rgba(27, 23, 19, 0.12)',
          borderRadius: '1rem',
          padding: '1rem',
          background: 'rgba(255, 251, 245, 0.94)',
        }}
      >
        <DocsSearchForm initialQuery={search.q} autoFocus />
      </div>
      {error ? <p>{error}</p> : null}
      {!query ? (
        <p style={{ margin: 0, opacity: 0.72 }}>Try searching for terms like <strong>router</strong>, <strong>head</strong>, or <strong>rpc</strong>.</p>
      ) : null}
      {query ? (
        <p style={{ margin: 0, opacity: 0.72 }}>
          Showing results for <strong>{query}</strong>
          {isLoading ? '...' : ` (${results.length} matches)`}
        </p>
      ) : null}
      <div style={{ display: 'grid', gap: '0.85rem' }}>
        {isLoading ? <p>Searching markdown files...</p> : null}
        {!isLoading && query && results.length === 0 ? (
          <p>No matches found for <strong>{query}</strong>.</p>
        ) : null}
        {results.map(result => (
          <article
            key={result.slug}
            style={{
              border: '1px solid rgba(27, 23, 19, 0.12)',
              borderRadius: '1rem',
              padding: '1rem',
              background: 'rgba(255, 251, 245, 0.92)',
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              <Link to="/docs/$slug" params={{ slug: result.slug }}>
                {result.title}
              </Link>
            </h2>
            <p>{result.excerpt}</p>
            <p style={{ marginBottom: 0, opacity: 0.65 }}>{result.matches} matching sections</p>
          </article>
        ))}
      </div>
    </section>
  );
}
