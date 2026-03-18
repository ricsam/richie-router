import { expect, test } from '@playwright/test';

test.describe('demo app', () => {
  test('injects server head tags into the initial HTML response', async ({ request }) => {
    const response = await request.get('/posts/alpha');
    const html = await response.text();

    expect(response.ok()).toBeTruthy();
    expect(html).toContain('Alpha Release Notes | Richie Router Demo</title>');
    expect(html).toContain('<meta name="description" content="The first cut of Richie Router with generated file routes."');
    expect(html).not.toContain('<!--richie-router-head-->');
    expect(html).toContain('<div id="app"></div>');
  });

  test('renders the home page in the browser', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Typed routes with server head tags only.' })).toBeVisible();
    await expect(page).toHaveTitle('Richie Router Demo');
  });

  test('loads posts from the real API endpoint', async ({ page }) => {
    await page.goto('/posts/alpha');

    await expect(page.getByText('Loading post content...')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Alpha Release Notes' })).toBeVisible();
    await expect(page.getByText('Post ID: alpha')).toBeVisible();
    await expect(page.getByText('The document head comes from the backend via a server head tag definition.')).toBeVisible();
    await expect(page).toHaveTitle('Alpha Release Notes | Richie Router Demo');
  });

  test('updates client-only head after navigation', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'About' }).click();

    await expect(page.getByRole('heading', { name: 'About the demo' })).toBeVisible();
    await expect(page).toHaveTitle('About Richie Router');
  });

  test('redirects guarded routes on the client', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/redirect=%2Fdashboard/);
    await expect(page.getByRole('heading', { name: 'Typed routes with server head tags only.' })).toBeVisible();
  });

  test('exposes the posts API', async ({ request }) => {
    const response = await request.get('/api/posts');
    const body = await response.json();

    expect(response.ok()).toBeTruthy();
    expect(Array.isArray(body)).toBeTruthy();
    expect(body.some((post: { id: string }) => post.id === 'alpha')).toBeTruthy();
  });
});
