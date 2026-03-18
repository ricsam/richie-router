import { expect, test } from '@playwright/test';

const docsBaseUrl = process.env.DOCS_BASE_URL ?? 'http://localhost:14233';

test.describe('docs app', () => {
  test('injects server head tags into the initial HTML response', async ({ request }) => {
    const response = await request.get(`${docsBaseUrl}/docs/seo`);
    const html = await response.text();

    expect(response.ok()).toBeTruthy();
    expect(html).toContain('SEO and Head Tags | @richie-router/ Docs</title>');
    expect(html).toContain('<meta name="description" content="@richie-router/ does not do React SSR. The server-side SEO story is focused on document head tags only."');
    expect(html).not.toContain('<!--richie-router-head-->');
    expect(html).toContain('<div id="app"></div>');
  });

  test('renders the docs home page in the browser', async ({ page }) => {
    await page.goto(`${docsBaseUrl}/`);

    await expect(page.getByRole('heading', { name: 'Browse @richie-router/ guides, reference docs, and examples.' })).toBeVisible();
    await expect(page).toHaveTitle('@richie-router/ Docs');
  });

  test('loads a markdown document over Richie RPC', async ({ page }) => {
    await page.goto(`${docsBaseUrl}/docs/seo`);

    await expect(page.getByRole('heading', { name: 'SEO and Head Tags' })).toBeVisible();
    await expect(page.locator('.docs-markdown code.hljs').first()).toBeVisible();
    await expect(page).toHaveTitle('SEO and Head Tags | @richie-router/ Docs');
  });

  test('searches the markdown files', async ({ page }) => {
    await page.goto(`${docsBaseUrl}/search`);
    await page.locator('#docs-main').getByLabel('Search the markdown docs').fill('masking');
    await page.locator('#docs-main').getByRole('button', { name: 'Search' }).click();

    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Route Masking' })).toBeVisible();
    await expect(page).toHaveURL(/\/search\?q=masking$/);
    await expect(page).toHaveTitle('Search: masking | @richie-router/ Docs');
  });
});
