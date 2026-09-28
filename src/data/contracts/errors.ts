export class DataAccessError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "DataAccessError";
  }
}

/** 403 — ресурс вне access scope пользователя. */

export class AccessDeniedError extends DataAccessError {
  constructor(message = "Недостаточно прав для просмотра этих данных") {
    super(message, 403, "forbidden");
    this.name = "AccessDeniedError";
  }
}

export class NotFoundError extends DataAccessError {
  constructor(message = "Запись не найдена") {
    super(message, 404, "not_found");
    this.name = "NotFoundError";
  }
}

export interface FieldError {
  field: string;
  message: string;
}

/** 422 — входные данные не прошли валидацию. */

export class ValidationError extends DataAccessError {
  constructor(
    public readonly fieldErrors: FieldError[],
    message = "Проверьте корректность введённых данных",
  ) {
    super(message, 422, "validation_error");
    this.name = "ValidationError";
  }
}

export function isAccessDenied(e: unknown): e is AccessDeniedError {
  return e instanceof DataAccessError && e.status === 403;
}

export function isNotFound(e: unknown): e is NotFoundError {
  return e instanceof DataAccessError && e.status === 404;
}
