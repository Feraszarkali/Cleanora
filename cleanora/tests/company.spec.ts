// tests/e2e/company-portal.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Company Portal', () => {
  test('company selector page loads', async ({ page }) => {
    await page.goto('/company')
    await expect(page.locator('text=Firmenportal')).toBeVisible()
    await expect(page.locator('select')).toBeVisible()
  })

  test('company login page loads', async ({ page }) => {
    await page.goto('/company/login')
    await expect(page.locator('form')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })

  test('dynamic company route loads for valid ID', async ({ page }) => {
    const testCompanyId = process.env.TEST_COMPANY_ID || '1'
    await page.goto(`/company/${testCompanyId}`)
    await page.waitForLoadState('networkidle')
    const hasLogoutButton = await page.locator('button:has-text("Abmelden")').count()
    const hasEmailInput = await page.locator('input[type="email"]').count()
    expect(hasLogoutButton + hasEmailInput).toBeGreaterThan(0)
  })

  test('company portal shows company info', async ({ page }) => {
    test.skip(!process.env.TEST_COMPANY_ID, 'No test company ID')
    
    // Login as company first
    await page.goto('/company/login')
    await page.fill('input[type="email"]', process.env.TEST_COMPANY_EMAIL!)
    await page.click('button:has-text("Anmelden")')
    
    await expect(page.locator('text=' + process.env.TEST_COMPANY_NAME)).toBeVisible()
    await expect(page.locator('text=Aktiv')).toBeVisible()
  })

  test('leads list displays', async ({ page }) => {
    test.skip(!process.env.TEST_COMPANY_ID, 'No test company ID')
    
    // Assume already logged in from previous test
    await page.goto(`/company/${process.env.TEST_COMPANY_ID}`)
    
    await expect(page.locator('article')).toBeVisible()
    await expect(page.locator('text=Unbekannter Kunde')).toBeVisible()
  })

  test('lead detail modal opens', async ({ page }) => {
    test.skip(!process.env.TEST_COMPANY_ID, 'No test company ID')
    
    await page.goto(`/company/${process.env.TEST_COMPANY_ID}`)
    await page.click('button:has-text("Details")')
    
    await expect(page.locator('text=Anfragedetails')).toBeVisible()
    await expect(page.locator('text=Name:')).toBeVisible()
  })

  test('status actions work', async ({ page }) => {
    test.skip(!process.env.TEST_COMPANY_ID, 'No test company ID')
    
    await page.goto(`/company/${process.env.TEST_COMPANY_ID}`)
    await page.click('button:has-text("Details")')
    
    // Click accept button
    await page.click('button:has-text("Annehmen")')
    await expect(page.locator('text=Status aktualisiert')).toBeVisible()
  })

  test('status filters work', async ({ page }) => {
    test.skip(!process.env.TEST_COMPANY_ID, 'No test company ID')
    
    await page.goto(`/company/${process.env.TEST_COMPANY_ID}`)
    await page.selectOption('select', 'accepted')
    
    await expect(page.locator('text=Angenommen')).toBeVisible()
  })

  test('search functionality', async ({ page }) => {
    test.skip(!process.env.TEST_COMPANY_ID, 'No test company ID')
    
    await page.goto(`/company/${process.env.TEST_COMPANY_ID}`)
    await page.fill('input[placeholder*="Suche"]', 'test')
    
    await expect(page.locator('text=test')).toBeVisible({ timeout: 5000 })
  })

  test('logout works', async ({ page }) => {
    test.skip(!process.env.TEST_COMPANY_ID, 'No test company ID')
    
    await page.goto(`/company/${process.env.TEST_COMPANY_ID}`)
    await page.click('button:has-text("Abmelden")')
    
    await expect(page).toHaveURL(/company\/login/)
  })

  test('no console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.goto('/company')
    expect(errors).toHaveLength(0)
  })
})