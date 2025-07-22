import { Component, FileStructure } from '../types.js';
import { readFile } from 'fs/promises';

export class CodeRelationAnalyzer {
  async analyzeComponents(projectPath: string, fileStructure: FileStructure, languages: string[]): Promise<Component[]> {
    const components: Component[] = [];
    
    // Actually parse file contents to extract real components
    await this.extractComponentsFromStructure(fileStructure, components, languages);
    
    return components;
  }

  private async extractComponentsFromStructure(structure: FileStructure, components: Component[], languages: string[]) {
    if (structure.type === 'file' && structure.language && languages.includes(structure.language)) {
      const basename = structure.name;
      const ext = structure.extension || '';
      
      if (this.isComponentFile(basename, ext, structure.language)) {
        try {
          // Parse actual file content
          const fileComponents = await this.parseFileContent(structure.path, structure.language);
          components.push(...fileComponents);
        } catch (error) {
          // Fallback if file reading fails
          console.warn(`Could not parse ${structure.path}: ${error}`);
          components.push({
            name: this.extractNameFromFile(basename),
            type: 'function',
            path: structure.path,
            language: structure.language
          });
        }
      }
    }

    if (structure.children) {
      for (const child of structure.children) {
        await this.extractComponentsFromStructure(child, components, languages);
      }
    }
  }

  private async parseFileContent(filePath: string, language: string): Promise<Component[]> {
    const content = await readFile(filePath, 'utf-8');
    const components: Component[] = [];

    switch (language) {
      case 'TypeScript':
      case 'JavaScript':
        return this.parseJavaScriptTypeScript(content, filePath, language);
      case 'Python':
        return this.parsePython(content, filePath);
      case 'Java':
        return this.parseJava(content, filePath);
      case 'C#':
        return this.parseCSharp(content, filePath);
      case 'Rust':
        return this.parseRust(content, filePath);
      case 'Go':
        return this.parseGo(content, filePath);
      case 'PHP':
        return this.parsePHP(content, filePath);
      case 'Ruby':
        return this.parseRuby(content, filePath);
      case 'C++':
      case 'C':
        return this.parseCCpp(content, filePath, language);
      default:
        return this.parseGeneric(content, filePath, language);
    }
  }

  private parseJavaScriptTypeScript(content: string, filePath: string, language: string): Component[] {
    const components: Component[] = [];

    // Parse classes
    const classMatches = content.matchAll(/(?:export\s+)?(?:default\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w\s,]+)?\s*\{/g);
    for (const match of classMatches) {
      if (match[1]) {
        components.push({
          name: match[1],
          type: 'class',
          path: filePath,
          language
        });
      }
    }

    // Parse functions
    const functionMatches = content.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g);
    for (const match of functionMatches) {
      if (match[1]) {
        components.push({
          name: match[1],
          type: 'function',
          path: filePath,
          language,
          async: content.includes(`async function ${match[1]}`)
        });
      }
    }

    // Parse arrow functions
    const arrowMatches = content.matchAll(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g);
    for (const match of arrowMatches) {
      if (match[1]) {
        components.push({
          name: match[1],
          type: 'function',
          path: filePath,
          language,
          async: content.includes(`async (`) || content.includes(`async(`)
        });
      }
    }

    // Parse interfaces (TypeScript only)
    if (language === 'TypeScript') {
      const interfaceMatches = content.matchAll(/(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+[\w\s,]+)?\s*\{/g);
      for (const match of interfaceMatches) {
        if (match[1]) {
          components.push({
            name: match[1],
            type: 'interface',
            path: filePath,
            language
          });
        }
      }

      // Parse type aliases
      const typeMatches = content.matchAll(/(?:export\s+)?type\s+(\w+)\s*=/g);
      for (const match of typeMatches) {
        if (match[1]) {
          components.push({
            name: match[1],
            type: 'interface',
            path: filePath,
            language
          });
        }
      }
    }

    return components;
  }

  private parsePython(content: string, filePath: string): Component[] {
    const components: Component[] = [];

    // Parse classes
    const classMatches = content.matchAll(/class\s+(\w+)(?:\([^)]*\))?:/g);
    for (const match of classMatches) {
      if (match[1]) {
        components.push({
          name: match[1],
          type: 'class',
          path: filePath,
          language: 'Python'
        });
      }
    }

    // Parse functions
    const functionMatches = content.matchAll(/def\s+(\w+)\s*\([^)]*\):/g);
    for (const match of functionMatches) {
      if (match[1]) {
        components.push({
          name: match[1],
          type: 'function',
          path: filePath,
          language: 'Python',
          async: content.includes(`async def ${match[1]}`)
        });
      }
    }

    return components;
  }

  private parseJava(content: string, filePath: string): Component[] {
    const components: Component[] = [];

    // Parse classes
    const classMatches = content.matchAll(/(?:public\s+|private\s+|protected\s+)?(?:abstract\s+|final\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w\s,]+)?\s*\{/g);
    for (const match of classMatches) {
      if (match[1]) {
        components.push({
          name: match[1],
          type: 'class',
          path: filePath,
          language: 'Java'
        });
      }
    }

    // Parse interfaces
    const interfaceMatches = content.matchAll(/(?:public\s+|private\s+|protected\s+)?interface\s+(\w+)(?:\s+extends\s+[\w\s,]+)?\s*\{/g);
    for (const match of interfaceMatches) {
      if (match[1]) {
        components.push({
          name: match[1],
          type: 'interface',
          path: filePath,
          language: 'Java'
        });
      }
    }

    // Parse enums
    const enumMatches = content.matchAll(/(?:public\s+|private\s+|protected\s+)?enum\s+(\w+)\s*\{/g);
    for (const match of enumMatches) {
      if (match[1]) {
        components.push({
          name: match[1],
          type: 'enum',
          path: filePath,
          language: 'Java'
        });
      }
    }

    return components;
  }

  private parseCSharp(content: string, filePath: string): Component[] {
    const components: Component[] = [];

    // Parse classes
    const classMatches = content.matchAll(/(?:public\s+|private\s+|protected\s+|internal\s+)?(?:abstract\s+|sealed\s+|static\s+)?class\s+(\w+)(?:\s*:\s*[\w\s,]+)?\s*\{/g);
    for (const match of classMatches) {
      if (match[1]) {
        components.push({
          name: match[1],
          type: 'class',
          path: filePath,
          language: 'C#'
        });
      }
    }

    // Parse interfaces
    const interfaceMatches = content.matchAll(/(?:public\s+|private\s+|protected\s+|internal\s+)?interface\s+(\w+)(?:\s*:\s*[\w\s,]+)?\s*\{/g);
    for (const match of interfaceMatches) {
      if (match[1]) {
        components.push({
          name: match[1],
          type: 'interface',
          path: filePath,
          language: 'C#'
        });
      }
    }

    // Parse structs
    const structMatches = content.matchAll(/(?:public\s+|private\s+|protected\s+|internal\s+)?struct\s+(\w+)(?:\s*:\s*[\w\s,]+)?\s*\{/g);
    for (const match of structMatches) {
      if (match[1]) {
        components.push({
          name: match[1],
          type: 'struct',
          path: filePath,
          language: 'C#'
        });
      }
    }

    return components;
  }

  private parseRust(content: string, filePath: string): Component[] {
    const components: Component[] = [];

    // Parse structs
    const structMatches = content.matchAll(/(?:pub\s+)?struct\s+(\w+)(?:<[^>]*>)?\s*\{/g);
    for (const match of structMatches) {
      if (match[1]) {
        components.push({
          name: match[1],
          type: 'struct',
          path: filePath,
          language: 'Rust'
        });
      }
    }

    // Parse enums
    const enumMatches = content.matchAll(/(?:pub\s+)?enum\s+(\w+)(?:<[^>]*>)?\s*\{/g);
    for (const match of enumMatches) {
      if (match[1]) {
        components.push({
          name: match[1],
          type: 'enum',
          path: filePath,
          language: 'Rust'
        });
      }
    }

    // Parse traits
    const traitMatches = content.matchAll(/(?:pub\s+)?trait\s+(\w+)(?:<[^>]*>)?(?:\s*:\s*[\w\s+]+)?\s*\{/g);
    for (const match of traitMatches) {
      if (match[1]) {
        components.push({
          name: match[1],
          type: 'trait',
          path: filePath,
          language: 'Rust'
        });
      }
    }

    // Parse functions
    const fnMatches = content.matchAll(/(?:pub\s+)?(?:async\s+)?fn\s+(\w+)(?:<[^>]*>)?\s*\(/g);
    for (const match of fnMatches) {
      if (match[1]) {
        components.push({
          name: match[1],
          type: 'function',
          path: filePath,
          language: 'Rust',
          async: content.includes(`async fn ${match[1]}`)
        });
      }
    }

    return components;
  }

  private parseGo(content: string, filePath: string): Component[] {
    const components: Component[] = [];

    // Parse structs
    const structMatches = content.matchAll(/type\s+(\w+)\s+struct\s*\{/g);
    for (const match of structMatches) {
      if (match[1]) {
        components.push({
          name: match[1],
          type: 'struct',
          path: filePath,
          language: 'Go'
        });
      }
    }

    // Parse interfaces
    const interfaceMatches = content.matchAll(/type\s+(\w+)\s+interface\s*\{/g);
    for (const match of interfaceMatches) {
      if (match[1]) {
        components.push({
          name: match[1],
          type: 'interface',
          path: filePath,
          language: 'Go'
        });
      }
    }

    // Parse functions
    const funcMatches = content.matchAll(/func\s+(?:\([^)]*\)\s+)?(\w+)\s*\(/g);
    for (const match of funcMatches) {
      if (match[1]) {
        components.push({
          name: match[1],
          type: 'function',
          path: filePath,
          language: 'Go'
        });
      }
    }

    return components;
  }

  private parsePHP(content: string, filePath: string): Component[] {
    const components: Component[] = [];

    // Parse classes
    const classMatches = content.matchAll(/(?:abstract\s+|final\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w\s,]+)?\s*\{/g);
    for (const match of classMatches) {
      if (match[1]) {
        components.push({
          name: match[1],
          type: 'class',
          path: filePath,
          language: 'PHP'
        });
      }
    }

    // Parse functions
    const functionMatches = content.matchAll(/function\s+(\w+)\s*\(/g);
    for (const match of functionMatches) {
      if (match[1]) {
        components.push({
          name: match[1],
          type: 'function',
          path: filePath,
          language: 'PHP'
        });
      }
    }

    return components;
  }

  private parseRuby(content: string, filePath: string): Component[] {
    const components: Component[] = [];

    // Parse classes
    const classMatches = content.matchAll(/class\s+(\w+)(?:\s*<\s*\w+)?\s*/g);
    for (const match of classMatches) {
      if (match[1]) {
        components.push({
          name: match[1],
          type: 'class',
          path: filePath,
          language: 'Ruby'
        });
      }
    }

    // Parse modules
    const moduleMatches = content.matchAll(/module\s+(\w+)\s*/g);
    for (const match of moduleMatches) {
      if (match[1]) {
        components.push({
          name: match[1],
          type: 'module',
          path: filePath,
          language: 'Ruby'
        });
      }
    }

    // Parse functions/methods
    const defMatches = content.matchAll(/def\s+(\w+)(?:\s*\([^)]*\))?\s*/g);
    for (const match of defMatches) {
      if (match[1]) {
        components.push({
          name: match[1],
          type: 'function',
          path: filePath,
          language: 'Ruby'
        });
      }
    }

    return components;
  }

  private parseCCpp(content: string, filePath: string, language: string): Component[] {
    const components: Component[] = [];

    // Parse classes (C++ only)
    if (language === 'C++') {
      const classMatches = content.matchAll(/class\s+(\w+)(?:\s*:\s*(?:public|private|protected)\s+[\w\s,]+)?\s*\{/g);
      for (const match of classMatches) {
        if (match[1]) {
          components.push({
            name: match[1],
            type: 'class',
            path: filePath,
            language
          });
        }
      }

      // Parse structs
      const structMatches = content.matchAll(/struct\s+(\w+)(?:\s*:\s*(?:public|private|protected)\s+[\w\s,]+)?\s*\{/g);
      for (const match of structMatches) {
        if (match[1]) {
          components.push({
            name: match[1],
            type: 'struct',
            path: filePath,
            language
          });
        }
      }
    }

    // Parse functions (both C and C++)
    const functionMatches = content.matchAll(/(?:static\s+)?(?:inline\s+)?(?:extern\s+)?[\w\s\*]+\s+(\w+)\s*\([^)]*\)\s*(?:\{|;)/g);
    for (const match of functionMatches) {
      if (match[1] && !['if', 'while', 'for', 'switch', 'return'].includes(match[1])) {
        components.push({
          name: match[1],
          type: 'function',
          path: filePath,
          language
        });
      }
    }

    return components;
  }

  private parseGeneric(content: string, filePath: string, language: string): Component[] {
    const components: Component[] = [];

    // Generic function detection
    const functionPatterns = [
      /function\s+(\w+)\s*\(/g,  // JavaScript style
      /def\s+(\w+)\s*\(/g,       // Python/Ruby style
      /func\s+(\w+)\s*\(/g,      // Go style
      /fn\s+(\w+)\s*\(/g         // Rust style
    ];

    for (const pattern of functionPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          components.push({
            name: match[1],
            type: 'function',
            path: filePath,
            language
          });
        }
      }
    }

    return components;
  }

  private isComponentFile(filename: string, extension: string, language: string): boolean {
    const componentPatterns: { [key: string]: string[] } = {
      'JavaScript': ['.js', '.jsx', '.mjs'],
      'TypeScript': ['.ts', '.tsx', '.mts'],
      'Python': ['.py', '.pyx'],
      'Rust': ['.rs'],
      'Go': ['.go'],
      'Java': ['.java'],
      'C#': ['.cs'],
      'PHP': ['.php'],
      'Ruby': ['.rb'],
      'C++': ['.cpp', '.cc', '.cxx', '.hpp', '.h'],
      'C': ['.c', '.h'],
      'Swift': ['.swift'],
      'Kotlin': ['.kt', '.kts'],
      'Dart': ['.dart'],
      'Scala': ['.scala'],
      'Clojure': ['.clj', '.cljs'],
      'Haskell': ['.hs'],
      'Perl': ['.pl'],
      'Shell': ['.sh', '.bash'],
      'PowerShell': ['.ps1'],
      'Lua': ['.lua'],
      'R': ['.r'],
      'MATLAB': ['.m'],
      'Julia': ['.jl'],
      'Elixir': ['.ex', '.exs'],
      'Erlang': ['.erl'],
      'F#': ['.fs'],
      'Nim': ['.nim']
    };

    return componentPatterns[language]?.includes(extension.toLowerCase()) || false;
  }

  private extractNameFromFile(filename: string): string {
    return filename.split('.')[0] || filename;
  }
}
