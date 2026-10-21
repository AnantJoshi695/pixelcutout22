import { test, expect } from '@playwright/test';

test('dark mode hero', async ({ page }) => {
  await page.goto('http://localhost:5177/');
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'screenshot-dark.png', fullPage: false });
});

test('dark mode how-it-works', async ({ page }) => {
  await page.goto('http://localhost:5177/');
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForTimeout(600);
  await page.locator('#how-it-works').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshot-howitworks-dark.png', fullPage: false });
});
