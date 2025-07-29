export enum ErrorCodes {
  INVALID_PATH = 'INVALID_PATH',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_INPUT = 'INVALID_INPUT',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  DEPENDENCY_ERROR = 'DEPENDENCY_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',
  FILE_SIZE_LIMIT_EXCEEDED = 'FILE_SIZE_LIMIT_EXCEEDED',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR'
}

export class ContextEngineError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown> | undefined;
  public readonly timestamp: string;

  constructor(
    code: string,
    message: string,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message);
    this.name = 'ContextEngineError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
    
    if (cause) {
      this.cause = cause;
    }

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ContextEngineError);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

export class ValidationError extends ContextEngineError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(ErrorCodes.VALIDATION_ERROR, message, context);
    this.name = 'ValidationError';
  }
}

export class PathValidationError extends ContextEngineError {
  constructor(path: string, reason?: string) {
    super(
      ErrorCodes.INVALID_PATH,
      `Invalid path: ${path}${reason ? ` - ${reason}` : ''}`,
      { path, reason }
    );
    this.name = 'PathValidationError';
  }
}

export class FileNotFoundError extends ContextEngineError {
  constructor(path: string) {
    super(
      ErrorCodes.FILE_NOT_FOUND,
      `File not found: ${path}`,
      { path }
    );
    this.name = 'FileNotFoundError';
  }
}

export class FileSizeLimitError extends ContextEngineError {
  constructor(path: string, size: number, limit: number) {
    super(
      ErrorCodes.FILE_SIZE_LIMIT_EXCEEDED,
      `File size (${size} bytes) exceeds limit (${limit} bytes): ${path}`,
      { path, size, limit }
    );
    this.name = 'FileSizeLimitError';
  }
}

export class MemoryLimitError extends ContextEngineError {
  constructor(operation: string, usage: number, limit: number) {
    super(
      ErrorCodes.MEMORY_LIMIT_EXCEEDED,
      `Memory usage (${usage}MB) exceeds limit (${limit}MB) during ${operation}`,
      { operation, usage, limit }
    );
    this.name = 'MemoryLimitError';
  }
}

export class ProcessingError extends ContextEngineError {
  constructor(operation: string, details: string, context?: Record<string, unknown>) {
    super(
      ErrorCodes.PROCESSING_ERROR,
      `Processing failed during ${operation}: ${details}`,
      { operation, details, ...context }
    );
    this.name = 'ProcessingError';
  }
}

export function isContextEngineError(error: unknown): error is ContextEngineError {
  return error instanceof Error && 'code' in error && typeof (error as any).code === 'string';
}

export function createErrorFromUnknown(error: unknown, defaultMessage = 'Unknown error occurred'): ContextEngineError {
  if (isContextEngineError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new ContextEngineError(
      ErrorCodes.PROCESSING_ERROR,
      error.message || defaultMessage,
      { originalError: error.name },
      error
    );
  }

  return new ContextEngineError(
    ErrorCodes.PROCESSING_ERROR,
    defaultMessage,
    { originalError: String(error) }
  );
}

export function handleAsyncError<T>(
  promise: Promise<T>,
  errorContext?: Record<string, unknown>
): Promise<T> {
  return promise.catch((error) => {
    const contextError = createErrorFromUnknown(error);
    // Create a new error with merged context since context is readonly
    const mergedContext = { ...contextError.context, ...errorContext };
    const newError = new ContextEngineError(
      contextError.code,
      contextError.message,
      mergedContext,
      contextError.cause as Error
    );
    throw newError;
  });
}
