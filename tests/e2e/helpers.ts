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
      promoId: STUDENT.promoId,
    }),
  })
  const data = await res.json()
  // Ignore if already exists (409 or "déjà utilisée" error)
  if (!data.ok && res.status !== 409 && !data.error?.includes('déjà')) {
    throw new Error(`Student provisioning failed: ${data.error}`)
  }
}

// ── Page helpers ─────────────────────────────────────────────────────────────
export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/')
  // Attendre que le formulaire de login soit charge
  await page.waitForSelector(SEL.emailInput, { timeout: 15_000 })
  await page.fill(SEL.emailInput, email)
  await page.fill(SEL.passwordInput, password)
  await page.click(SEL.submitBtn)
}

export async function loginAndWaitDashboard(page: Page, email: string, password: string): Promise<void> {
  await login(page, email, password)
  await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 })
}

/** Navigue vers une section via le bouton NavRail (aria-label) */
export async function navigateTo(page: Page, section: 'messages' | 'devoirs' | 'documents' | 'dashboard'): Promise<void> {
  // Attendre que la NavRail soit rendue
  await page.waitForSelector('.nav-rail', { timeout: 15_000 })
  // La NavRail utilise des <button> avec aria-label="Section X"
  const btn = page.locator(`button[aria-label*="${section}" i], .nav-btn:has-text("${section}")`)
  await btn.first().click({ timeout: 10_000 })
  await expect(page).toHaveURL(new RegExp(section), { timeout: 10_000 })
}
