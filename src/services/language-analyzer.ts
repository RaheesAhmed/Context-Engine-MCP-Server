import path from 'path';
import type { ProgrammingLanguage, LanguagePatterns, CodeStructure } from '../types/index.js';
import logger from '../utils/logger.js';

export class LanguageAnalyzer {
  private static readonly LANGUAGE_MAP: Record<string, ProgrammingLanguage> = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.pyw': 'python',
    '.java': 'java',
    '.cs': 'csharp',
    '.cpp': 'cpp',
    '.cxx': 'cpp',
    '.cc': 'cpp',
    '.c++': 'cpp',
    '.c': 'c',
    '.h': 'c',
    '.hpp': 'cpp',
    '.php': 'php',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.vue': 'vue',
    '.svelte': 'svelte',
  };

  private static readonly DEPENDENCY_PATTERNS: LanguagePatterns = {
    javascript: [
      /import\s+.*\s+from\s+['"`]([^'"`]+)['"`]/g,
      /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /export\s+.*\s+from\s+['"`]([^'"`]+)['"`]/g,
    ],
    typescript: [
      /import\s+.*\s+from\s+['"`]([^'"`]+)['"`]/g,
      /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /export\s+.*\s+from\s+['"`]([^'"`]+)['"`]/g,
      /import\s+type\s+.*\s+from\s+['"`]([^'"`]+)['"`]/g,
    ],
    python: [
      /from\s+([^\s]+)\s+import/g,
      /import\s+([^\s,;]+)/g,
    ],
    java: [
      /import\s+([^;]+);/g,
      /import\s+static\s+([^;]+);/g,
    ],
    csharp: [
      /using\s+([^;]+);/g,
    ],
    cpp: [
      /#include\s*[<"]([^>"]+)[>"]/g,
    ],
    c: [
      /#include\s*[<"]([^>"]+)[>"]/g,
    ],
    php: [
      /require_once\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /include_once\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /include\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /use\s+([^;]+);/g,
    ],
    ruby: [
      /require\s+['"`]([^'"`]+)['"`]/g,
      /require_relative\s+['"`]([^'"`]+)['"`]/g,
      /load\s+['"`]([^'"`]+)['"`]/g,
    ],
    go: [
      /import\s+['"`]([^'"`]+)['"`]/g,
      /import\s+\(\s*([^)]+)\s*\)/g,
    ],
    rust: [
      /use\s+([^;]+);/g,
      /extern\s+crate\s+([^;]+);/g,
    ],
  };

  /**
   * Detect programming language from file path
   */
  static detectLanguage(filePath: string): ProgrammingLanguage {
    const ext = path.extname(filePath).toLowerCase();
    return this.LANGUAGE_MAP[ext] || 'text';
  }

  /**
   * Check if a language is supported for analysis
   */
  static isLanguageSupported(language: ProgrammingLanguage): boolean {
    return language !== 'text' && Object.keys(this.DEPENDENCY_PATTERNS).includes(language);
  }

  /**
   * Extract dependencies from code content
   */
  static async extractDependencies(content: string, language: ProgrammingLanguage): Promise<string[]> {
    const dependencies = new Set<string>();
    const patterns = this.DEPENDENCY_PATTERNS[language] || [];

    try {
      for (const pattern of patterns) {
        // Reset regex lastIndex to ensure proper matching
        pattern.lastIndex = 0;
        
        let match;
        while ((match = pattern.exec(content)) !== null) {
          if (match[1]) {
            // Clean up the dependency string
            let dep = match[1].trim();
            
            // Handle special cases for different languages
            dep = this.cleanDependencyString(dep, language);
            
            if (dep) {
              dependencies.add(dep);
            }
          }
          
          // Prevent infinite loops on global regexes
          if (!pattern.global) break;
        }
      }

      return Array.from(dependencies);
    } catch (error) {
      logger.error('Error extracting dependencies', { 
        language, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return [];
    }
  }

  /**
   * Extract code structure (functions, classes, etc.) from content
   */
  static async extractCodeStructure(content: string, language: ProgrammingLanguage): Promise<CodeStructure> {
    const structure: CodeStructure = {
      functions: [],
      classes: [],
      exports: [],
      imports: [],
      variables: [],
      comments: []
    };

    try {
      switch (language) {
        case 'javascript':
        case 'typescript':
          await this.extractJavaScriptStructure(content, structure);
          break;
        case 'python':
          await this.extractPythonStructure(content, structure);
          break;
        case 'java':
          await this.extractJavaStructure(content, structure);
          break;
        case 'csharp':
          await this.extractCSharpStructure(content, structure);
          break;
        case 'cpp':
        case 'c':
          await this.extractCppStructure(content, structure);
          break;
        case 'php':
          await this.extractPhpStructure(content, structure);
          break;
        case 'ruby':
          await this.extractRubyStructure(content, structure);
          break;
        case 'go':
          await this.extractGoStructure(content, structure);
          break;
        case 'rust':
          await this.extractRustStructure(content, structure);
          break;
        default:
          // For unsupported languages, only extract comments
          await this.extractComments(content, structure);
      }

      // Always extract comments regardless of language
      await this.extractComments(content, structure);

      return structure;
    } catch (error) {
      logger.error('Error extracting code structure', {
        language,
        error: error instanceof Error ? error.message : String(error)
      });
      return structure;
    }
  }

  /**
   * Clean dependency string based on language-specific rules
   */
  private static cleanDependencyString(dep: string, language: ProgrammingLanguage): string {
    // Remove quotes and whitespace
    dep = dep.replace(/['"]/g, '').trim();

    switch (language) {
      case 'python':
        // Remove 'as alias' parts
        dep = dep.split(' as ')[0]?.trim() || '';
        break;
      case 'java':
      case 'csharp':
        // Remove static keyword for Java
        dep = dep.replace(/^static\s+/, '');
        break;
      case 'go':
        // Handle Go import blocks
        if (dep.includes('\n')) {
          return dep.split('\n')
            .map(line => line.trim().replace(/['"]/g, ''))
            .filter(line => line && !line.startsWith('//'))
            .join('');
        }
        break;
    }

    return dep;
  }

  /**
   * Extract JavaScript/TypeScript structure
   */
  private static async extractJavaScriptStructure(content: string, structure: CodeStructure): Promise<void> {
    // Function declarations and expressions
    const functionPatterns = [
      /function\s+(\w+)/g,
      /const\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)/g,
      /let\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)/g,
      /var\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)/g,
      /(\w+)\s*:\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)/g,
      /async\s+function\s+(\w+)/g,
    ];

    for (const pattern of functionPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1] && !structure.functions.includes(match[1])) {
          structure.functions.push(match[1]);
        }
      }
    }

    // Class declarations
    const classPattern = /class\s+(\w+)/g;
    let classMatch;
    while ((classMatch = classPattern.exec(content)) !== null) {
      if (classMatch[1]) {
        structure.classes.push(classMatch[1]);
      }
    }

    // Export statements
    const exportPatterns = [
      /export\s+(?:default\s+)?(?:const\s+|let\s+|var\s+|function\s+|class\s+)?(\w+)/g,
      /export\s*{\s*([^}]+)\s*}/g,
      /module\.exports\s*=\s*(\w+)/g,
      /exports\.(\w+)/g,
    ];

    for (const pattern of exportPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1]) {
          if (pattern.source.includes('{')) {
            // Handle named exports in braces
            const namedExports = match[1].split(',')
              .map(e => e.trim().split(' as ')[0])
              .filter((item): item is string => Boolean(item))
              .map(item => item.trim())
              .filter(Boolean);
            structure.exports.push(...namedExports);
          } else {
            structure.exports.push(match[1]);
          }
        }
      }
    }

    // Variable declarations
    const variablePatterns = [
      /(?:const|let|var)\s+(\w+)/g,
    ];

    for (const pattern of variablePatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1] && !structure.functions.includes(match[1]) && !structure.classes.includes(match[1])) {
          structure.variables.push(match[1]);
        }
      }
    }
  }

  /**
   * Extract Python structure
   */
  private static async extractPythonStructure(content: string, structure: CodeStructure): Promise<void> {
    // Function definitions
    const functionPattern = /def\s+(\w+)/g;
    let funcMatch;
    while ((funcMatch = functionPattern.exec(content)) !== null) {
      if (funcMatch[1]) {
        structure.functions.push(funcMatch[1]);
      }
    }

    // Class definitions
    const classPattern = /class\s+(\w+)/g;
    let classMatch;
    while ((classMatch = classPattern.exec(content)) !== null) {
      if (classMatch[1]) {
        structure.classes.push(classMatch[1]);
      }
    }

    // Variable assignments (basic detection)
    const variablePattern = /^(\w+)\s*=/gm;
    let varMatch;
    while ((varMatch = variablePattern.exec(content)) !== null) {
      if (varMatch[1] && !structure.functions.includes(varMatch[1]) && !structure.classes.includes(varMatch[1])) {
        structure.variables.push(varMatch[1]);
      }
    }
  }

  /**
   * Extract Java structure
   */
  private static async extractJavaStructure(content: string, structure: CodeStructure): Promise<void> {
    // Method declarations
    const methodPattern = /(?:public|private|protected)?\s*(?:static)?\s*(?:\w+\s+)*(\w+)\s*\(/g;
    let methodMatch;
    while ((methodMatch = methodPattern.exec(content)) !== null) {
      if (methodMatch[1] && methodMatch[1] !== 'if' && methodMatch[1] !== 'while' && methodMatch[1] !== 'for') {
        structure.functions.push(methodMatch[1]);
      }
    }

    // Class declarations
    const classPattern = /(?:public|private|protected)?\s*(?:abstract|final)?\s*class\s+(\w+)/g;
    let classMatch;
    while ((classMatch = classPattern.exec(content)) !== null) {
      if (classMatch[1]) {
        structure.classes.push(classMatch[1]);
      }
    }

    // Interface declarations
    const interfacePattern = /(?:public|private|protected)?\s*interface\s+(\w+)/g;
    let interfaceMatch;
    while ((interfaceMatch = interfacePattern.exec(content)) !== null) {
      if (interfaceMatch[1]) {
        structure.classes.push(interfaceMatch[1]); // Treating interfaces as classes for simplicity
      }
    }
  }

  /**
   * Extract C# structure
   */
  private static async extractCSharpStructure(content: string, structure: CodeStructure): Promise<void> {
    // Method declarations
    const methodPattern = /(?:public|private|protected|internal)?\s*(?:static|virtual|override)?\s*(?:\w+\s+)*(\w+)\s*\(/g;
    let methodMatch;
    while ((methodMatch = methodPattern.exec(content)) !== null) {
      if (methodMatch[1] && methodMatch[1] !== 'if' && methodMatch[1] !== 'while' && methodMatch[1] !== 'for') {
        structure.functions.push(methodMatch[1]);
      }
    }

    // Class declarations
    const classPattern = /(?:public|private|protected|internal)?\s*(?:abstract|sealed|static|partial)?\s*class\s+(\w+)/g;
    let classMatch;
    while ((classMatch = classPattern.exec(content)) !== null) {
      if (classMatch[1]) {
        structure.classes.push(classMatch[1]);
      }
    }

    // Interface declarations
    const interfacePattern = /(?:public|private|protected|internal)?\s*interface\s+(\w+)/g;
    let interfaceMatch;
    while ((interfaceMatch = interfacePattern.exec(content)) !== null) {
      if (interfaceMatch[1]) {
        structure.classes.push(interfaceMatch[1]);
      }
    }
  }

  /**
   * Extract C/C++ structure
   */
  private static async extractCppStructure(content: string, structure: CodeStructure): Promise<void> {
    // Function declarations
    const functionPattern = /(?:\w+\s+)*(\w+)\s*\([^)]*\)\s*(?:{|;)/g;
    let funcMatch;
    while ((funcMatch = functionPattern.exec(content)) !== null) {
      if (funcMatch[1] && funcMatch[1] !== 'if' && funcMatch[1] !== 'while' && funcMatch[1] !== 'for') {
        structure.functions.push(funcMatch[1]);
      }
    }

    // Class declarations
    const classPattern = /class\s+(\w+)/g;
    let classMatch;
    while ((classMatch = classPattern.exec(content)) !== null) {
      if (classMatch[1]) {
        structure.classes.push(classMatch[1]);
      }
    }

    // Struct declarations (treating as classes)
    const structPattern = /struct\s+(\w+)/g;
    let structMatch;
    while ((structMatch = structPattern.exec(content)) !== null) {
      if (structMatch[1]) {
        structure.classes.push(structMatch[1]);
      }
    }
  }

  /**
   * Extract PHP structure
   */
  private static async extractPhpStructure(content: string, structure: CodeStructure): Promise<void> {
    // Function declarations
    const functionPattern = /function\s+(\w+)/g;
    let funcMatch;
    while ((funcMatch = functionPattern.exec(content)) !== null) {
      if (funcMatch[1]) {
        structure.functions.push(funcMatch[1]);
      }
    }

    // Class declarations
    const classPattern = /class\s+(\w+)/g;
    let classMatch;
    while ((classMatch = classPattern.exec(content)) !== null) {
      if (classMatch[1]) {
        structure.classes.push(classMatch[1]);
      }
    }
  }

  /**
   * Extract Ruby structure
   */
  private static async extractRubyStructure(content: string, structure: CodeStructure): Promise<void> {
    // Method definitions
    const methodPattern = /def\s+(\w+)/g;
    let methodMatch;
    while ((methodMatch = methodPattern.exec(content)) !== null) {
      if (methodMatch[1]) {
        structure.functions.push(methodMatch[1]);
      }
    }

    // Class definitions
    const classPattern = /class\s+(\w+)/g;
    let classMatch;
    while ((classMatch = classPattern.exec(content)) !== null) {
      if (classMatch[1]) {
        structure.classes.push(classMatch[1]);
      }
    }

    // Module definitions
    const modulePattern = /module\s+(\w+)/g;
    let moduleMatch;
    while ((moduleMatch = modulePattern.exec(content)) !== null) {
      if (moduleMatch[1]) {
        structure.classes.push(moduleMatch[1]); // Treating modules as classes
      }
    }
  }

  /**
   * Extract Go structure
   */
  private static async extractGoStructure(content: string, structure: CodeStructure): Promise<void> {
    // Function declarations
    const functionPattern = /func\s+(?:\([^)]*\)\s+)?(\w+)/g;
    let funcMatch;
    while ((funcMatch = functionPattern.exec(content)) !== null) {
      if (funcMatch[1]) {
        structure.functions.push(funcMatch[1]);
      }
    }

    // Type declarations (treating as classes)
    const typePattern = /type\s+(\w+)\s+(?:struct|interface)/g;
    let typeMatch;
    while ((typeMatch = typePattern.exec(content)) !== null) {
      if (typeMatch[1]) {
        structure.classes.push(typeMatch[1]);
      }
    }
  }

  /**
   * Extract Rust structure
   */
  private static async extractRustStructure(content: string, structure: CodeStructure): Promise<void> {
    // Function declarations
    const functionPattern = /fn\s+(\w+)/g;
    let funcMatch;
    while ((funcMatch = functionPattern.exec(content)) !== null) {
      if (funcMatch[1]) {
        structure.functions.push(funcMatch[1]);
      }
    }

    // Struct declarations
    const structPattern = /struct\s+(\w+)/g;
    let structMatch;
    while ((structMatch = structPattern.exec(content)) !== null) {
      if (structMatch[1]) {
        structure.classes.push(structMatch[1]);
      }
    }

    // Enum declarations
    const enumPattern = /enum\s+(\w+)/g;
    let enumMatch;
    while ((enumMatch = enumPattern.exec(content)) !== null) {
      if (enumMatch[1]) {
        structure.classes.push(enumMatch[1]);
      }
    }

    // Trait declarations
    const traitPattern = /trait\s+(\w+)/g;
    let traitMatch;
    while ((traitMatch = traitPattern.exec(content)) !== null) {
      if (traitMatch[1]) {
        structure.classes.push(traitMatch[1]);
      }
    }
  }

  /**
   * Extract comments from content
   */
  private static async extractComments(content: string, structure: CodeStructure): Promise<void> {
    const commentPatterns = [
      /\/\*\*([\s\S]*?)\*\//g, // JSDoc comments
      /\/\*([\s\S]*?)\*\//g,   // Multi-line comments
      /\/\/(.*)$/gm,           // Single-line comments (//)
      /#(.*)$/gm,              // Hash comments
      /"""([\s\S]*?)"""/g,     // Python docstrings
      /'''([\s\S]*?)'''/g,     // Python docstrings
    ];

    for (const pattern of commentPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const comment = (match[1] || match[0]).trim();
        if (comment.length > 10) { // Only meaningful comments
          structure.comments.push(comment);
        }
      }
    }

    // Remove duplicates and limit number of comments
    structure.comments = [...new Set(structure.comments)].slice(0, 20);
  }
}
