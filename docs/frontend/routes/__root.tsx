import { Link, Outlet, createRootRoute, useLocation } from '@richie-router/react';
import { DocsSearchForm } from '../search-form';

export const Route = createRootRoute({
  component: RootLayout,
});

function NavLink(props: Parameters<typeof Link>[0]) {
  return (
    <Link
      {...props}
      activeProps={{
        style: {
          textDecoration: 'underline',
          fontWeight: 700,
        },
      }}
    />
  );
}

function RootLayout() {
  const location = useLocation();
  const currentQuery =
    location.pathname === '/search' && typeof location.search.q === 'string' ? location.search.q : '';

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, rgba(198, 166, 120, 0.35), transparent 30%), linear-gradient(180deg, #fbf7f1 0%, #efe5d6 100%)',
      }}
    >
      <header
        style={{
          padding: '1.5rem 2rem',
          borderBottom: '1px solid rgba(27, 23, 19, 0.12)',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <strong style={{ fontSize: '1.3rem' }}>@richie-router/ Docs</strong>
          <p style={{ margin: '0.25rem 0 0', opacity: 0.7 }}>Guides and reference for the Bun + TypeScript router.</p>
        </div>
        <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <NavLink to="/" activeOptions={{ exact: true }}>
            Home
          </NavLink>
          <NavLink to="/search" search={{ q: '' }}>
            Search
          </NavLink>
        </nav>
        <div style={{ flex: '1 1 280px', display: 'flex', justifyContent: 'flex-end' }}>
          <DocsSearchForm compact initialQuery={currentQuery} />
        </div>
      </header>
      <main
        id="docs-main"
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '2rem',
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
