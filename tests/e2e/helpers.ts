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

interface ApiResponse {
  ok: boolean
  error?: string
  data?: Record<string, unknown>
}

export async function getTeacherToken(): Promise<string> {
  if (teacherToken) return teacherToken
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEACHER.email, password: TEACHER.password }),
  })
  const data = await res.json() as ApiResponse
  if (!data.ok) throw new Error(`Teacher login failed: ${data.error}`)
  teacherToken = data.data?.token as string
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
  const data = await res.json() as ApiResponse
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
  // L'URL contient deja /dashboard/ (redirect /), donc le vrai signal de login est l'app-shell.
  await page.waitForSelector('#app-shell, .app-shell, .app-columns', { state: 'attached', timeout: 20_000 })
  // Petit delai pour laisser Vue monter les composants enfants
  await page.waitForTimeout(1_000)
}

/** Navigue vers une section via le bouton NavRail (aria-label) */
export async function navigateTo(page: Page, section: 'messages' | 'devoirs' | 'documents' | 'dashboard'): Promise<void> {
  // Capitaliser le nom de section pour le matching texte
  const capitalized = section[0].toUpperCase() + section.slice(1)

  // Strategie multi-selecteur : aria-label "Section X", nav-label text, ou title
  const btn = page.locator([
    `button[aria-label*="${section}" i]`,
    `.nav-btn:has(.nav-label:text-is("${capitalized}"))`,
    `button[title*="${section}" i]`,
    `a[href*="${section}"]`,
  ].join(', ')).first()

  // Attendre que le bouton soit visible et stable avant de cliquer
  await expect(btn).toBeVisible({ timeout: 20_000 })
  await btn.click()
  await expect(page).toHaveURL(new RegExp(section), { timeout: 15_000 })
}
