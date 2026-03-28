/**
 * Classes d'erreurs structurees pour le backend.
 * Remplace le string matching dans wrap.js par des status codes explicites.
 */

class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Ressource introuvable') { super(message, 404) }
}

class ForbiddenError extends AppError {
  constructor(message = 'Acces refuse') { super(message, 403) }
}

class ConflictError extends AppError {
  constructor(message = 'Conflit de donnees') { super(message, 409) }
}

class ValidationError extends AppError {
  constructor(message = 'Donnees invalides') { super(message, 422) }
}

module.exports = { AppError, NotFoundError, ForbiddenError, ConflictError, ValidationError }
