import { Link, createFileRoute } from '@richie-router/react';

export const Route = createFileRoute('/')({
  component: IndexPage,
  head: {
    meta: [
      { title: 'Richie Router Demo' },
      {
        name: 'description',
        content: 'Browse the demo routes, typed links, server head tags, and client-rendered navigation.',
      },
    ],
  },
});

function FeatureCard(props: { title: string; children: React.ReactNode }) {
  return (
    <article
      style={{
        padding: '1rem',
        border: '1px solid rgba(29, 20, 13, 0.14)',
        borderRadius: '1rem',
        background: 'rgba(255, 250, 241, 0.9)',
      }}
    >
      <h2 style={{ marginTop: 0 }}>{props.title}</h2>
      <div style={{ opacity: 0.85 }}>{props.children}</div>
    </article>
  );
}

function IndexPage() {
  return (
    <section style={{ display: 'grid', gap: '1.5rem' }}>
      <div>
        <p style={{ textTransform: 'uppercase', letterSpacing: '0.18em', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
          End-to-end verification
        </p>
        <h1 style={{ margin: 0, fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}>Typed routes with server head tags only.</h1>
        <p style={{ maxWidth: '52rem', lineHeight: 1.6 }}>
          This demo verifies nested file routes, pathless layouts, search params, dynamic params, server-resolved head
          tags, client rendering, and compile-time checked navigation helpers.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <FeatureCard title="Server Head Tags">
          <p>Open a post to see the title and description resolved on the backend without rendering React there.</p>
          <Link to="/posts">Open posts</Link>
        </FeatureCard>
        <FeatureCard title="Typed Search">
          <p>The search page uses a shared head tag schema, so navigation and server head input stay aligned.</p>
          <Link to="/search" search={{ query: 'routing', limit: 3 }}>
            Search for routing
          </Link>
        </FeatureCard>
        <FeatureCard title="Pathless Guard">
          <p>The dashboard still lives under a pathless `_auth` layout, but the redirect happens on the client.</p>
          <Link to="/dashboard" search={{ auth: true }}>
            Open dashboard
          </Link>
        </FeatureCard>
      </div>
    </section>
  );
}
