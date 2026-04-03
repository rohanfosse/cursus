import { type Page, expect } from '@playwright/test'

// ── Credentials ──────────────────────────────────────────────────────────────
// Teacher from schema v12 migration (rfosse@cesi.fr, password 'admin' hashed at v16)
export const TEACHER = { email: 'rfosse@cesi.fr', password: 'admin' }

// Test student provisioned via API before tests (fixed email to avoid orphan accumulation)
export const STUDENT = {
  name: 'E2E Student',
  email: 'e2e-student@test.fr',
  password: 'E2eTest1234!',
  promoId: 1,
}

export const API_BASE = process.env.API_BASE || 'http://localhost:3001'

// ── Selectors ────────────────────────────────────────────────────────────────
export const SEL = {
  emailInput: 'input[type="email"], input[placeholder*="email" i], input[name="email"]',
  passwordInput: 'input[type="password"]',
  submitBtn: 'button[type="submit"], button:has-text("Connexion")',
}

// ── API helpers ──────────────────────────────────────────────────────────────
let teacherToken: string | null = null

export async function getTeacherToken(): Promise<string> {
  if (teacherToken) return teacherToken
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEACHER.email, password: TEACHER.password }),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(`Teacher login failed: ${data.error}`)
  teacherToken = data.data.token
  return teacherToken!
}

export async function provisionStudent(): Promise<void> {
  const token = await getTeacherToken()
  // Register student via API
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      name: STUDENT.name,
      email: STUDENT.email,
      password: STUDENT.password,
      promo_id: STUDENT.promoId,
    }),
  })
  const data = await res.json()
  // Ignore if already exists (409)
  if (!data.ok && res.status !== 409) {
    throw new Error(`Student provisioning failed: ${data.error}`)
  }
}

// ── Page helpers ─────────────────────────────────────────────────────────────
export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/')
  await page.fill(SEL.emailInput, email)
  await page.fill(SEL.passwordInput, password)
  await page.click(SEL.submitBtn)
}

export async function loginAndWaitDashboard(page: Page, email: string, password: string): Promise<void> {
  await login(page, email, password)
  // May need to change password first (must_change_password)
  const changePwdModal = page.locator('text=/changer.*mot de passe|nouveau mot de passe/i').first()
  if (await changePwdModal.isVisible({ timeout: 2_000 }).catch(() => false)) {
    // Fill new password fields and submit
    const inputs = page.locator('input[type="password"]')
    const count = await inputs.count()
    for (let i = 0; i < count; i++) {
      await inputs.nth(i).fill(password)
    }
    await page.click('button[type="submit"], button:has-text("Valider"), button:has-text("Enregistrer")')
  }
  // May need to complete onboarding
  const onboarding = page.locator('text=/bienvenue.*cursus/i').first()
  if (await onboarding.isVisible({ timeout: 2_000 }).catch(() => false)) {
    // Click through all steps
    for (let i = 0; i < 5; i++) {
      const nextBtn = page.locator('button:has-text("Commencer"), button:has-text("Suivant"), button:has-text("Entrer")')
      if (await nextBtn.first().isVisible({ timeout: 1_000 }).catch(() => false)) {
        await nextBtn.first().click()
      }
    }
  }
  await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 })
}
