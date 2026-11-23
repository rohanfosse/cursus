import { test, expect } from '@playwright/test'
import { TEACHER, STUDENT, loginAndWaitDashboard, provisionStudent } from './helpers'

/**
 * Verifie que les gardes de route bloquent l'acces aux sections
 * protegees par role et redirigent vers /dashboard.
 *
 * Hierarchie des roles : student(0) < ta(1) < teacher(2) < admin(3)
 */
test.describe('Gardes de route (contrôle d\'accès par rôle)', () => {

  test('étudiant redirigé depuis /exam-review vers /dashboard', async ({ page }) => {
    // /exam-review/:id requiert le role "teacher" (meta.requiredRole)
    await provisionStudent()
    await loginAndWaitDashboard(page, STUDENT.email, STUDENT.password)
    await page.goto('/#/exam-review/1')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('enseignant redirigé depuis /admin vers /dashboard', async ({ page }) => {
    // /admin requiert le role "admin" (level 3) ; teacher = level 2
    await loginAndWaitDashboard(page, TEACHER.email, TEACHER.password)
    await page.goto('/#/admin')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

})
