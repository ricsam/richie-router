import { createFileRoute } from '@richie-router/react';

export const Route = createFileRoute('/search')({
  component: SearchPage,
});

function SearchPage() {
  const search = Route.useSearch();

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div>
        <h1 style={{ marginBottom: '0.25rem' }}>Search</h1>
        <p style={{ margin: 0 }}>
          Query <strong>{search.query}</strong>, limit <strong>{search.limit}</strong>
        </p>
      </div>
      <div
        style={{
          border: '1px solid rgba(29, 20, 13, 0.14)',
          borderRadius: '1rem',
          padding: '1rem',
          background: 'rgba(255, 251, 245, 0.92)',
        }}
      >
        <p style={{ marginTop: 0 }}>
          This route demonstrates typed search params without any built-in data loading.
        </p>
        <p style={{ marginBottom: 0 }}>
          The backend uses the same search schema to resolve a server head tag for the initial HTML and client
          navigations.
        </p>
      </div>
    </section>
  );
}
