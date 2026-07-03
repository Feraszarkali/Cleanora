import { test, expect } from '@playwright/test'

test('admin page does not stay stuck on loading', async ({ page }) => {
  await page.goto('/admin')
  await page.waitForLoadState('networkidle')

  await expect(page.locator('body')).not.toContainText('Loading...')
})
