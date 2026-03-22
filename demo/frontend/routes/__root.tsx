import { Link, Outlet, createRootRoute } from '@richie-router/react';

export const Route = createRootRoute({
  component: RootLayout,
});

function NavLink(props: Parameters<typeof Link>[0]) {
  return (
    <Link
      {...props}
      activeProps={{
        style: {
          fontWeight: 700,
          textDecoration: 'underline',
        },
      }}
    />
  );
}

function RootLayout() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, rgba(214, 175, 122, 0.45), transparent 35%), linear-gradient(180deg, #fbf5ec 0%, #f0e2cf 100%)',
      }}
    >
      <header
        style={{
          padding: '1.5rem 2rem',
          borderBottom: '1px solid rgba(29, 20, 13, 0.14)',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <strong style={{ fontSize: '1.25rem' }}>Richie Router</strong>
          <p style={{ margin: '0.25rem 0 0', opacity: 0.75 }}>
            File-based routes, typed search, server head tags, and Bun.
          </p>
        </div>
        <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <NavLink to="/" activeOptions={{ exact: true }}>
            Home
          </NavLink>
          <NavLink to="/about">About</NavLink>
          <NavLink to="/posts">Posts</NavLink>
          <NavLink to="/search" search={{ query: 'router', limit: 2 }}>
            Search
          </NavLink>
          <NavLink to="/dashboard" search={{ auth: true }}>
            Dashboard
          </NavLink>
        </nav>
      </header>
      <main
        id="main-content"
        style={{
          padding: '2rem',
          maxWidth: '1100px',
          margin: '0 auto',
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
