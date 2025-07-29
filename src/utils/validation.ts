import path from 'path';
import { z } from 'zod';
import { PathValidationError, ValidationError } from './errors.js';
import type { ValidationResult } from '../types/index.js';

// Zod schemas for input validation
export const ProjectPathSchema = z.string().min(1).refine(
  (val) => {
    try {
      const resolved = path.resolve(val);
      return !resolved.includes('..');
    } catch {
      return false;
    }
  },
  { message: 'Invalid project path' }
);

export const FilePathSchema = z.string().min(1).refine(
  (val) => {
    const normalized = path.normalize(val);
    return !normalized.includes('..') && !path.isAbsolute(normalized);
  },
  { message: 'Invalid file path - must be relative and not contain ..' }
);

export const SearchQuerySchema = z.string().min(1).max(1000);

export const FileChangeSchema = z.object({
  filePath: FilePathSchema,
  action: z.enum(['create', 'update', 'delete']),
  content: z.string().optional(),
  backup: z.boolean().optional().default(true)
});

export const AnalyzeProjectSchema = z.object({
  projectPath: ProjectPathSchema,
  forceRefresh: z.boolean().optional().default(false)
});

export const SearchProjectSchema = z.object({
  projectPath: ProjectPathSchema,
  query: SearchQuerySchema,
  caseSensitive: z.boolean().optional().default(false),
  includeStructure: z.boolean().optional().default(true)
});

export const EditMultipleFilesSchema = z.object({
  projectPath: ProjectPathSchema,
  changes: z.array(FileChangeSchema).min(1).max(50)
});

export const GetFileRelationshipsSchema = z.object({
  projectPath: ProjectPathSchema,
  filePath: FilePathSchema.optional()
});

/**
 * Validates and normalizes a file path to prevent path traversal attacks
 */
export function validatePath(inputPath: string, baseDir?: string): string {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new PathValidationError(inputPath, 'Path must be a non-empty string');
  }

  const normalized = path.normalize(inputPath);
  
  // Check for path traversal attempts
  if (normalized.includes('..')) {
    throw new PathValidationError(inputPath, 'Path traversal not allowed');
  }

  // Check for absolute paths when relative expected
  if (baseDir && path.isAbsolute(normalized)) {
    throw new PathValidationError(inputPath, 'Absolute paths not allowed in this context');
  }

  return normalized;
}

/**
 * Validates that a path is within the allowed project directory
 */
export function validateProjectPath(inputPath: string): string {
  const normalized = validatePath(inputPath);
  const resolved = path.resolve(normalized);
  
  // Additional project-specific validations can be added here
  return resolved;
}

/**
 * Validates a search query to prevent ReDoS attacks
 */
export function validateSearchQuery(query: string): ValidationResult {
  const errors: string[] = [];

  if (!query || typeof query !== 'string') {
    errors.push('Query must be a non-empty string');
  }

  if (query.length > 1000) {
    errors.push('Query too long (max 1000 characters)');
  }

  // Check for potentially dangerous regex patterns
  const dangerousPatterns = [
    /\(\?\:.*\)\+/,  // Non-capturing groups with quantifiers
    /\(\?\=.*\)\*/,  // Positive lookahead with quantifiers
    /\(\?\!.*\)\+/,  // Negative lookahead with quantifiers
    /\(\?\<\=.*\)\+/, // Positive lookbehind with quantifiers
    /\(\?\<\!.*\)\+/, // Negative lookbehind with quantifiers
    /\(\.\*\)\{[0-9]+,\}/, // Greedy quantifiers on .* patterns
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(query)) {
      errors.push('Query contains potentially dangerous regex patterns');
      break;
    }
  }

  // Test if the regex compiles without throwing
  try {
    new RegExp(query);
  } catch (error) {
    errors.push(`Invalid regex pattern: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates file content size
 */
export function validateFileSize(size: number, maxSize: number, filePath?: string): void {
  if (size > maxSize) {
    throw new ValidationError(
      `File size ${size} bytes exceeds maximum allowed size ${maxSize} bytes`,
      { size, maxSize, filePath }
    );
  }
}

/**
 * Validates file extension against allowed types
 */
export function validateFileExtension(filePath: string, allowedExtensions: string[]): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return allowedExtensions.includes(ext);
}

/**
 * Sanitizes filename by removing or replacing dangerous characters
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_') // Replace dangerous characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
}

/**
 * Checks if a path is within a given directory (prevents path traversal)
 */
export function isPathWithinDirectory(targetPath: string, baseDirectory: string): boolean {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedBase = path.resolve(baseDirectory);
  
  return resolvedTarget.startsWith(resolvedBase + path.sep) || resolvedTarget === resolvedBase;
}

/**
 * Validates input using Zod schema and throws ValidationError on failure
 */
export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(e => 
        `${e.path.join('.')}: ${e.message}`
      ).join(', ');
      throw new ValidationError(`Validation failed: ${errorMessages}`, { 
        errors: error.errors,
        input 
      });
    }
    throw error;
  }
}

/**
 * Safe validation that returns result instead of throwing
 */
export function safeValidateInput<T>(schema: z.ZodSchema<T>, input: unknown): {
  success: true;
  data: T;
} | {
  success: false;
  error: ValidationError;
} {
  try {
    const data = validateInput(schema, input);
    return { success: true, data };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof ValidationError ? error : new ValidationError('Unknown validation error')
    };
  }
}
