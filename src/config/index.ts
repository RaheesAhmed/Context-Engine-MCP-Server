import { ServerConfig } from '../types/index.js';

export const DEFAULT_CONFIG: ServerConfig = {
  maxCacheSize: 1000,
  cacheCleanupInterval: 300000, // 5 minutes
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxContentLength: 50000,
  backupDirectory: '.context-engine-backups',
  logLevel: 'info',
  supportedLanguages: [
    'javascript',
    'typescript',
    'python',
    'java',
    'csharp',
    'cpp',
    'c',
    'php',
    'ruby',
    'go',
    'rust',
    'vue',
    'svelte'
  ],
  ignorePatterns: [
    '**/node_modules/**',
    '**/venv/**',
    '**/env/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/*.min.js',
    '**/*.log',
    '**/.next/**',
    '**/coverage/**',
    '**/.vscode/**',
    '**/.idea/**'
  ],
  filePatterns: [
    '**/*.js',
    '**/*.jsx',
    '**/*.ts',
    '**/*.tsx',
    '**/*.py',
    '**/*.java',
    '**/*.cs',
    '**/*.cpp',
    '**/*.c++',
    '**/*.cc',
    '**/*.c',
    '**/*.h',
    '**/*.hpp',
    '**/*.php',
    '**/*.rb',
    '**/*.go',
    '**/*.rs',
    '**/*.vue',
    '**/*.svelte',
    '**/*.html',
    '**/*.css',
    '**/*.scss',
    '**/*.sass',
    '**/*.less',
    '**/package.json',
    '**/requirements.txt',
    '**/pom.xml',
    '**/Cargo.toml',
    '**/go.mod',
    '**/Dockerfile',
    '**/*.yml',
    '**/*.yaml',
    '**/*.json',
    '**/README.md',
    '**/README.txt',
    '**/*.md'
  ]
};

export class ConfigManager {
  private config: ServerConfig;

  constructor(userConfig: Partial<ServerConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...userConfig
    };
  }

  get<K extends keyof ServerConfig>(key: K): ServerConfig[K] {
    return this.config[key];
  }

  set<K extends keyof ServerConfig>(key: K, value: ServerConfig[K]): void {
    this.config[key] = value;
  }

  getAll(): ServerConfig {
    return { ...this.config };
  }

  update(updates: Partial<ServerConfig>): void {
    this.config = {
      ...this.config,
      ...updates
    };
  }

  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.maxCacheSize <= 0) {
      errors.push('maxCacheSize must be greater than 0');
    }

    if (this.config.cacheCleanupInterval < 60000) {
      errors.push('cacheCleanupInterval must be at least 60000ms (1 minute)');
    }

    if (this.config.maxFileSize <= 0) {
      errors.push('maxFileSize must be greater than 0');
    }

    if (this.config.maxContentLength <= 0) {
      errors.push('maxContentLength must be greater than 0');
    }

    if (!['debug', 'info', 'warn', 'error'].includes(this.config.logLevel)) {
      errors.push('logLevel must be one of: debug, info, warn, error');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export const configManager = new ConfigManager();
