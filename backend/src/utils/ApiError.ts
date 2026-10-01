/**
 * Error HTTP tipado. Se lanza desde cualquier capa (service/controller) y
 * lo traduce el errorHandler central a una respuesta JSON consistente.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = "ApiError";
  }

  static badRequest(message: string, code = "BAD_REQUEST") {
    return new ApiError(400, code, message);
  }

  static unauthorized(message: string, code = "UNAUTHORIZED") {
    return new ApiError(401, code, message);
  }

  static forbidden(message: string, code = "FORBIDDEN") {
    return new ApiError(403, code, message);
  }

  static notFound(message: string, code = "NOT_FOUND") {
    return new ApiError(404, code, message);
  }

  static conflict(message: string, code = "CONFLICT") {
    return new ApiError(409, code, message);
  }
}
