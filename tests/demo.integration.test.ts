import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { startDemoServer } from '../demo/backend/app';

let server: ReturnType<typeof startDemoServer>;
let origin = '';

beforeAll(() => {
  server = startDemoServer({ port: 0 });
  origin = server.url.origin;
});

afterAll(() => {
  server.stop(true);
});

describe('richie-router demo', () => {
  test('renders the SPA shell with server head snapshot but no SSR app markup', async () => {
    const response = await fetch(`${origin}/`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('Richie Router Demo');
    expect(html).toContain('window.__RICHIE_ROUTER_HEAD__');
    expect(html).toContain('<div id="app"></div>');
    expect(html).not.toContain('Typed routes with server head tags only.');
  });

  test('renders server-resolved head tags for a dynamic route without rendering the page body', async () => {
    const response = await fetch(`${origin}/posts/alpha`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('Alpha Release Notes | Richie Router Demo');
    expect(html).toContain('The first cut of Richie Router with generated file routes.');
    expect(html).toContain('<div id="app"></div>');
    expect(html).not.toContain('Post ID: alpha');
  });

  test('serves head API responses for client navigation', async () => {
    const params = encodeURIComponent(JSON.stringify({}));
    const search = encodeURIComponent(JSON.stringify({ query: 'router', limit: 2 }));
    const response = await fetch(`${origin}/head-api/search-page?routeId=%2Fsearch&params=${params}&search=${search}`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.head.meta).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Search: router' }),
        expect.objectContaining({
          name: 'description',
          content: 'Search demo page for "router" with limit 2.',
        }),
      ]),
    );
  });

  test('does not evaluate client-only head declarations on the server', async () => {
    const response = await fetch(`${origin}/about`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).not.toContain('About Richie Router');
  });

  test('returns the shell for guarded routes and leaves the redirect to the client router', async () => {
    const response = await fetch(`${origin}/dashboard`, { redirect: 'manual' });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<div id="app"></div>');
  });
});
