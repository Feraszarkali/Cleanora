import { test, expect } from '@playwright/test'

test('company pages load', async ({ page }) => {
  await page.goto('/company')
  await expect(page.locator('body')).toBeVisible()

  const companySelect = page.locator('select')
  if (await companySelect.count()) {
    await expect(companySelect.first()).toBeVisible()
  }

  await page.goto('/company/16')
  await expect(page.locator('body')).toBeVisible()
})
