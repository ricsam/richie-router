import { createFileRoute } from '@richie-router/react';

export const Route = createFileRoute('/about')({
  component: AboutPage,
  head: {
    meta: [
      { title: 'About Richie Router' },
      { name: 'description', content: 'What this demo is exercising and why.' },
    ],
  },
});

function AboutPage() {
  return (
    <article style={{ maxWidth: '42rem', lineHeight: 1.7 }}>
      <h1>About the demo</h1>
      <p>
        The implementation in this repository is structured like a small Bun workspace so the demo imports the packages
        exactly the way a consumer application would.
      </p>
      <p>
        The generated files now split into a client route tree and a server-safe route manifest so the backend never
        has to import your frontend route modules.
      </p>
    </article>
  );
}
