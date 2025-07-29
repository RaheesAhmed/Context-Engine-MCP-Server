export interface ProjectMetadata {
  name: string;
  type: string;
  version: string;
  description: string;
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
  frameworks: string[];
  readme?: string;
}

export interface CodeStructure {
  functions: string[];
  classes: string[];
  exports: string[];
  imports: string[];
  variables: string[];
  comments: string[];
}

export interface FileInfo {
  path: string;
  absolutePath: string;
  language: string;
  size: number;
  lines: number;
  hash: string;
  lastModified: Date;
  dependencies: string[];
  structure: CodeStructure;
  content: string;
}

export interface ProjectStructure {
  totalFiles: number;
  languages: string[];
  frameworks: string[];
  dependencies: Map<string, string[]>;
  exports: Map<string, string[]>;
  functions: Record<string, string[]>;
  classes: Record<string, string[]>;
}

export interface ProjectContext {
  projectPath: string;
  timestamp: string;
  files: Map<string, FileInfo>;
  structure: ProjectStructure;
  metadata: ProjectMetadata;
}

export interface SearchMatch {
  line?: number;
  content?: string;
  context?: string[];
  type?: string;
  name?: string;
}

export interface SearchResult {
  file: string;
  language: string;
  matches: SearchMatch[];
}

export interface FileChange {
  filePath: string;
  action: 'create' | 'update' | 'delete';
  content?: string | undefined;
  backup?: boolean | undefined;
}

export interface EditResult {
  file: string;
  status: 'created' | 'updated' | 'deleted' | 'error';
  error?: string;
}

export interface FileRelationships {
  dependencies: string[];
  dependents: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  hash?: string;
}

export interface ServerConfig {
  maxCacheSize: number;
  cacheCleanupInterval: number;
  maxFileSize: number;
  maxContentLength: number;
  backupDirectory: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  supportedLanguages: string[];
  ignorePatterns: string[];
  filePatterns: string[];
}

export type ProgrammingLanguage = 
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'csharp'
  | 'cpp'
  | 'c'
  | 'php'
  | 'ruby'
  | 'go'
  | 'rust'
  | 'vue'
  | 'svelte'
  | 'text';

export interface LanguagePatterns {
  [key: string]: RegExp[];
}

export interface ContextEngineError extends Error {
  code: string;
  context?: Record<string, unknown>;
}
