describe('logger', () => {
  let stdoutSpy, stderrSpy

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    // Reset module cache to pick up fresh logger
    vi.resetModules()
  })

  afterEach(() => {
    stdoutSpy.mockRestore()
    stderrSpy.mockRestore()
  })

  it('writes info to stdout as JSON', () => {
    const logger = require('../../../server/utils/logger')
    logger.info('test_event', { key: 'value' })
    expect(stdoutSpy).toHaveBeenCalledOnce()
    const output = stdoutSpy.mock.calls[0][0]
    const parsed = JSON.parse(output)
    expect(parsed.level).toBe('info')
    expect(parsed.msg).toBe('test_event')
    expect(parsed.key).toBe('value')
    expect(parsed.ts).toBeDefined()
  })

  it('writes error to stderr', () => {
    const logger = require('../../../server/utils/logger')
    logger.error('crash', { code: 500 })
    expect(stderrSpy).toHaveBeenCalledOnce()
    const parsed = JSON.parse(stderrSpy.mock.calls[0][0])
    expect(parsed.level).toBe('error')
    expect(parsed.msg).toBe('crash')
    expect(parsed.code).toBe(500)
  })

  it('writes warn to stdout', () => {
    const logger = require('../../../server/utils/logger')
    logger.warn('deprecated')
    expect(stdoutSpy).toHaveBeenCalledOnce()
    const parsed = JSON.parse(stdoutSpy.mock.calls[0][0])
    expect(parsed.level).toBe('warn')
  })

  it('includes ISO timestamp', () => {
    const logger = require('../../../server/utils/logger')
    logger.info('ts_check')
    const parsed = JSON.parse(stdoutSpy.mock.calls[0][0])
    expect(parsed.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
