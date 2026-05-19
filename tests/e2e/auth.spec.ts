import { test, expect } from '@playwright/test'

test('company login page loads', async ({ page }) => {
  await page.goto('/company/login')
  await expect(page.locator('form')).toBeVisible()
  await expect(page.locator('input[type="email"]')).toBeVisible()
})
