/**
 * Tests pour les utilitaires github (validation + parsing des URLs repo).
 */
import { describe, it, expect } from 'vitest'
import { isValidGitHubUrl, parseGitHubUrl } from '@/utils/github'

describe('isValidGitHubUrl', () => {
  it('accepte les URLs github.com/owner/repo', () => {
    expect(isValidGitHubUrl('https://github.com/owner/repo')).toBe(true)
    expect(isValidGitHubUrl('https://github.com/owner/repo/')).toBe(true)
    expect(isValidGitHubUrl('https://github.com/owner/repo.git')).toBe(true)
    expect(isValidGitHubUrl('https://github.com/owner/repo/tree/main/src')).toBe(true)
  })

  it('tolere les espaces autour', () => {
    expect(isValidGitHubUrl('  https://github.com/owner/repo  ')).toBe(true)
  })

  it('refuse HTTP non-securise', () => {
    expect(isValidGitHubUrl('http://github.com/owner/repo')).toBe(false)
  })

  it('refuse les autres hosts', () => {
    expect(isValidGitHubUrl('https://gitlab.com/owner/repo')).toBe(false)
    expect(isValidGitHubUrl('https://bitbucket.org/owner/repo')).toBe(false)
    expect(isValidGitHubUrl('https://github.com.evil.com/owner/repo')).toBe(false)
  })

  it('refuse les URLs sans repo', () => {
    expect(isValidGitHubUrl('https://github.com/owner')).toBe(false)
    expect(isValidGitHubUrl('https://github.com/')).toBe(false)
    expect(isValidGitHubUrl('https://github.com')).toBe(false)
  })

  it('refuse les strings non-URL', () => {
    expect(isValidGitHubUrl('pas une url')).toBe(false)
    expect(isValidGitHubUrl('')).toBe(false)
    expect(isValidGitHubUrl('   ')).toBe(false)
  })
})

describe('parseGitHubUrl', () => {
  it('extrait owner et repo d URLs valides', () => {
    expect(parseGitHubUrl('https://github.com/alice/project-x')).toEqual({ owner: 'alice', repo: 'project-x' })
  })

  it('retire l extension .git', () => {
    expect(parseGitHubUrl('https://github.com/alice/project.git')).toEqual({ owner: 'alice', repo: 'project' })
  })

  it('ignore les sous-chemins', () => {
    expect(parseGitHubUrl('https://github.com/alice/project/tree/main/src')).toEqual({ owner: 'alice', repo: 'project' })
  })

  it('retourne null pour les URLs invalides', () => {
    expect(parseGitHubUrl('not a url')).toBeNull()
    expect(parseGitHubUrl('https://gitlab.com/owner/repo')).toBeNull()
    expect(parseGitHubUrl('')).toBeNull()
  })
})
