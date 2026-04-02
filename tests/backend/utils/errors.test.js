const {
  AppError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} = require('../../../server/utils/errors')

describe('AppError', () => {
  it('sets message and default status 400', () => {
    const err = new AppError('Something wrong')
    expect(err.message).toBe('Something wrong')
    expect(err.statusCode).toBe(400)
    expect(err.name).toBe('AppError')
    expect(err).toBeInstanceOf(Error)
  })

  it('accepts custom status code', () => {
    const err = new AppError('Service unavailable', 503)
    expect(err.statusCode).toBe(503)
  })
})

describe('NotFoundError', () => {
  it('sets status 404 with default message', () => {
    const err = new NotFoundError()
    expect(err.statusCode).toBe(404)
    expect(err.message).toBe('Ressource introuvable')
    expect(err.name).toBe('NotFoundError')
  })

  it('accepts custom message', () => {
    const err = new NotFoundError('Étudiant introuvable')
    expect(err.message).toBe('Étudiant introuvable')
    expect(err.statusCode).toBe(404)
  })

  it('is instanceof AppError and Error', () => {
    const err = new NotFoundError()
    expect(err).toBeInstanceOf(AppError)
    expect(err).toBeInstanceOf(Error)
  })
})

describe('ForbiddenError', () => {
  it('sets status 403', () => {
    const err = new ForbiddenError()
    expect(err.statusCode).toBe(403)
    expect(err.name).toBe('ForbiddenError')
  })
})

describe('ConflictError', () => {
  it('sets status 409', () => {
    const err = new ConflictError()
    expect(err.statusCode).toBe(409)
    expect(err.name).toBe('ConflictError')
  })
})

describe('ValidationError', () => {
  it('sets status 422', () => {
    const err = new ValidationError()
    expect(err.statusCode).toBe(422)
    expect(err.name).toBe('ValidationError')
  })
})
