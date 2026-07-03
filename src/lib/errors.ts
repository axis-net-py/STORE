import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'APP_ERROR',
    public readonly statusCode: number = 400
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class AuthError extends AppError {
  constructor(message = 'Sessão inválida. Faça login novamente.') {
    super(message, 'AUTH_ERROR', 401)
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 422)
  }
}

export class NotFoundError extends AppError {
  constructor(entity = 'Registro') {
    super(`${entity} não encontrado.`, 'NOT_FOUND', 404)
  }
}

export function formatZodError(error: ZodError): string {
  return error.issues.map(e => e.message).join('; ')
}

export function handleActionError(error: unknown): never {
  if (error instanceof ZodError) {
    throw new ValidationError(formatZodError(error))
  }
  if (error instanceof AppError) throw error
  if (error instanceof Error) throw new AppError(error.message)
  throw new AppError('Erro interno do servidor')
}

export function toApiError(error: unknown): { message: string; code: string; status: number } {
  if (error instanceof ZodError) {
    return { message: formatZodError(error), code: 'VALIDATION_ERROR', status: 422 }
  }
  if (error instanceof AppError) {
    return { message: error.message, code: error.code, status: error.statusCode }
  }
  if (error instanceof Error) {
    return { message: error.message, code: 'APP_ERROR', status: 500 }
  }
  return { message: 'Erro interno do servidor', code: 'UNKNOWN_ERROR', status: 500 }
}
