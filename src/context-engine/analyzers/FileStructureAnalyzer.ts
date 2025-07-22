import * as fs from 'fs/promises';
import * as path from 'path';
import { FileStructure, AnalyzerOptions, LanguageInfo } from '../types.js';

export class FileStructureAnalyzer {
  private defaultOptions: AnalyzerOptions = {
    maxDepth: 10,
    includeTests: true,
    includeNodeModules: false,
    fileExtensions: [
      // Web Technologies
      '.ts', '.js', '.tsx', '.jsx', '.vue', '.svelte', '.html', '.css', '.scss', '.sass', '.less',
      // Backend Languages
      '.py', '.pyi', '.pyc', '.rs', '.go', '.java', '.kt', '.scala', '.cs', '.fs', '.vb',
      '.php', '.rb', '.pl', '.sh', '.bash', '.zsh', '.fish',
      // Systems Programming
      '.c', '.cpp', '.cc', '.cxx', '.hpp', '.h', '.asm', '.s',
      // Data Science & Analysis
      '.r', '.R', '.rmd', '.Rmd', '.ipynb', '.jl', '.m', '.mat',
      // Functional Programming
      '.hs', '.lhs', '.elm', '.clj', '.cljs', '.cljc', '.edn', '.lisp', '.scm',
      '.ml', '.mli', '.fs', '.fsi', '.fsx', '.fsscript',
      // Configuration & Data
      '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.xml',
      '.env', '.properties', '.config', '.settings',
      // Documentation
      '.md', '.rst', '.txt', '.adoc', '.tex',
      // Build & Package Management
      '.gradle', '.sbt', '.pom', '.cmake', '.make', '.dockerfile', 'Dockerfile',
      '.gemfile', '.podspec', '.nuspec', '.csproj', '.fsproj', '.vbproj',
      // Mobile Development
      '.swift', '.m', '.mm', '.dart', '.kt'
    ]
  };

  private languagePatterns = {
    // Web Frontend
    'JavaScript': ['.js', '.mjs', '.cjs'],
    'TypeScript': ['.ts', '.tsx'],
    'React': ['.jsx', '.tsx'],
    'Vue': ['.vue'],
    'Svelte': ['.svelte'],
    'HTML': ['.html', '.htm', '.xhtml'],
    'CSS': ['.css', '.scss', '.sass', '.less', '.stylus'],
    
    // Backend & Systems
    'Python': ['.py', '.pyi', '.pyc', '.pyw', '.pyx'],
    'Rust': ['.rs'],
    'Go': ['.go'],
    'Java': ['.java'],
    'Kotlin': ['.kt', '.kts'],
    'Scala': ['.scala', '.sc'],
    'C#': ['.cs'],
    'F#': ['.fs', '.fsi', '.fsx'],
    'VB.NET': ['.vb'],
    'PHP': ['.php', '.phtml', '.php3', '.php4', '.php5'],
    'Ruby': ['.rb', '.rbw', '.rake', '.gemspec'],
    'Perl': ['.pl', '.pm', '.pod'],
    'Shell': ['.sh', '.bash', '.zsh', '.fish', '.csh', '.tcsh'],
    
    // Systems Programming
    'C': ['.c', '.h'],
    'C++': ['.cpp', '.cc', '.cxx', '.hpp', '.h++', '.hxx'],
    'Assembly': ['.asm', '.s', '.S'],
    
    // Data Science & Analysis
    'R': ['.r', '.R', '.rmd', '.Rmd'],
    'Julia': ['.jl'],
    'MATLAB': ['.m', '.mat', '.fig', '.mlx'],
    'Jupyter': ['.ipynb'],
    
    // Functional Programming
    'Haskell': ['.hs', '.lhs'],
    'Elm': ['.elm'],
    'Clojure': ['.clj', '.cljs', '.cljc', '.edn'],
    'CommonLisp': ['.lisp', '.lsp', '.cl'],
    'Scheme': ['.scm', '.ss'],
    'OCaml': ['.ml', '.mli'],
    'Erlang': ['.erl', '.hrl'],
    'Elixir': ['.ex', '.exs'],
    
    // Mobile
    'Swift': ['.swift'],
    'Objective-C': ['.m', '.mm', '.h'],
    'Dart': ['.dart'],
    
    // Configuration & Data
    'JSON': ['.json', '.jsonc', '.json5'],
    'YAML': ['.yaml', '.yml'],
    'TOML': ['.toml'],
    'XML': ['.xml', '.xsd', '.xsl', '.xslt'],
    'INI': ['.ini', '.cfg', '.conf'],
    
    // Documentation
    'Markdown': ['.md', '.markdown', '.mdown', '.mkd'],
    'RestructuredText': ['.rst', '.rest'],
    'LaTeX': ['.tex', '.sty', '.cls'],
    'AsciiDoc': ['.adoc', '.asciidoc'],
    
    // Build Systems
    'Gradle': ['.gradle'],
    'Maven': ['.pom'],
    'CMake': ['.cmake', 'CMakeLists.txt'],
    'Make': ['.make', 'Makefile', 'makefile'],
    'Docker': ['Dockerfile', '.dockerfile'],
    'Bazel': ['BUILD', 'WORKSPACE', '.bazel', '.bzl']
  };

  async analyze(projectPath: string, options?: AnalyzerOptions): Promise<FileStructure> {
    const opts = { ...this.defaultOptions, ...options };
    const structure = await this.scanDirectory(projectPath, 0, opts);
    
    // Enhance structure with language analysis
    this.enhanceWithLanguageInfo(structure);
    
    return structure;
  }

  private async scanDirectory(
    dirPath: string,
    depth: number,
    options: AnalyzerOptions
  ): Promise<FileStructure> {
    if (depth > options.maxDepth!) {
      return {
        path: dirPath,
        name: path.basename(dirPath),
        type: 'directory',
        children: []
      };
    }

    const stats = await fs.stat(dirPath);
    
    if (!stats.isDirectory()) {
      return this.createFileNode(dirPath, stats);
    }

    const entries = await fs.readdir(dirPath);
    const children: FileStructure[] = [];

    for (const entry of entries) {
      // Skip common ignored directories
      if (this.shouldSkipDirectory(entry, options)) {
        continue;
      }

      // Skip hidden files/directories (except important ones)
      if (this.shouldSkipHidden(entry)) {
        continue;
      }

      const entryPath = path.join(dirPath, entry);
      try {
        const entryStats = await fs.stat(entryPath);
        
        if (entryStats.isDirectory()) {
          const child = await this.scanDirectory(entryPath, depth + 1, options);
          children.push(child);
        } else {
          if (this.shouldIncludeFile(entry, options)) {
            const child = this.createFileNode(entryPath, entryStats);
            children.push(child);
          }
        }
      } catch (error) {
        // Skip files we can't access
        console.warn(`Skipping ${entryPath}: ${error}`);
      }
    }

    return {
      path: dirPath,
      name: path.basename(dirPath),
      type: 'directory',
      children: children.sort((a, b) => {
        // Directories first, then files
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      })
    };
  }

  private shouldSkipDirectory(entry: string, options: AnalyzerOptions): boolean {
    const skipDirs = [
      'node_modules', '.git', '.svn', '.hg', '.bzr',
      '__pycache__', '.pytest_cache', '.mypy_cache',
      'target', 'build', 'dist', 'out', 'bin', 'obj',
      '.gradle', '.maven', '.sbt',
      '.vscode', '.idea', '.vs',
      'coverage', '.nyc_output', '.coverage',
      'venv', 'env', '.env', 'virtualenv',
      '.conda', 'conda-meta',
      'Pods', 'DerivedData',
      '.stack-work', '.cabal-sandbox'
    ];

    if (entry === 'node_modules' && options.includeNodeModules) {
      return false;
    }

    return skipDirs.includes(entry);
  }

  private shouldSkipHidden(entry: string): boolean {
    if (!entry.startsWith('.')) return false;

    const allowedHidden = [
      '.env', '.env.local', '.env.production', '.env.development',
      '.gitignore', '.gitattributes', '.github',
      '.eslintrc', '.eslintrc.js', '.eslintrc.json',
      '.prettierrc', '.prettierrc.js', '.prettierrc.json',
      '.babelrc', '.babelrc.js', '.babelrc.json',
      '.dockerignore', '.editorconfig',
      '.travis.yml', '.circleci', '.github',
      '.cargo', '.rustfmt.toml', '.clippy.toml'
    ];

    return !allowedHidden.some(allowed => entry.startsWith(allowed));
  }

  private shouldIncludeFile(entry: string, options: AnalyzerOptions): boolean {
    const ext = path.extname(entry).toLowerCase();
    
    // Always include if extension is in our list
    if (options.fileExtensions!.includes(ext)) {
      return true;
    }

    // Include important files without extensions
    const importantFiles = [
      'Makefile', 'makefile', 'Dockerfile', 'Jenkinsfile',
      'Cargo.toml', 'Cargo.lock', 'pyproject.toml', 'setup.py',
      'requirements.txt', 'poetry.lock', 'pipfile', 'pipfile.lock',
      'go.mod', 'go.sum', 'build.gradle', 'pom.xml',
      'CMakeLists.txt', 'BUILD', 'WORKSPACE'
    ];

    return importantFiles.includes(entry.toLowerCase());
  }

  private createFileNode(filePath: string, stats: any): FileStructure {
    const basename = path.basename(filePath);
    const extension = path.extname(filePath);
    const language = this.detectLanguage(basename, extension);
    
    const node: FileStructure = {
      path: filePath,
      name: basename,
      type: 'file',
      size: stats.size,
      extension,
      entryPoint: this.isEntryPoint(basename),
      configFile: this.isConfigFile(basename),
      testFile: this.isTestFile(filePath),
      buildFile: this.isBuildFile(basename),
      documentationFile: this.isDocumentationFile(basename, extension)
    };

    if (language) {
      node.language = language;
    }

    return node;
  }

  private detectLanguage(filename: string, extension: string): string | undefined {
    // Special cases for files without extensions
    const specialFiles: { [key: string]: string } = {
      'Dockerfile': 'Docker',
      'Makefile': 'Make',
      'makefile': 'Make',
      'Jenkinsfile': 'Groovy',
      'Vagrantfile': 'Ruby',
      'Gemfile': 'Ruby',
      'Rakefile': 'Ruby'
    };

    if (specialFiles[filename]) {
      return specialFiles[filename];
    }

    // Find language by extension
    for (const [language, extensions] of Object.entries(this.languagePatterns)) {
      if (extensions.includes(extension.toLowerCase())) {
        return language;
      }
    }

    return undefined;
  }

  private isEntryPoint(filename: string): boolean {
    const entryPoints = [
      'index.ts', 'index.js', 'index.tsx', 'index.jsx',
      'main.ts', 'main.js', 'main.py', 'main.go',
      'main.rs', 'main.java', 'main.kt', 'main.scala',
      'app.ts', 'app.js', 'app.py', 'app.go',
      'server.ts', 'server.js', 'server.py', 'server.go',
      'lib.rs', 'mod.rs', '__init__.py', '__main__.py'
    ];
    return entryPoints.includes(filename.toLowerCase());
  }

  private isConfigFile(filename: string): boolean {
    const configFiles = [
      'package.json', 'tsconfig.json', 'jsconfig.json',
      'webpack.config.js', 'vite.config.js', 'rollup.config.js',
      'babel.config.js', '.babelrc', '.eslintrc', '.prettierrc',
      'tailwind.config.js', 'next.config.js', 'nuxt.config.js',
      'cargo.toml', 'cargo.lock', 'rust-toolchain',
      'go.mod', 'go.sum',
      'requirements.txt', 'setup.py', 'setup.cfg', 'pyproject.toml',
      'poetry.lock', 'pipfile', 'pipfile.lock',
      'build.gradle', 'settings.gradle', 'gradle.properties',
      'pom.xml', 'build.sbt', 'project.clj',
      'composer.json', 'composer.lock',
      '.env', '.env.local', '.env.production', '.env.development',
      'dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
      'makefile', 'cmakelists.txt', 'build', 'workspace'
    ];
    
    return configFiles.includes(filename.toLowerCase()) ||
           filename.endsWith('.config.js') ||
           filename.endsWith('.config.ts') ||
           filename.endsWith('.config.json') ||
           filename.endsWith('.yml') ||
           filename.endsWith('.yaml') ||
           filename.endsWith('.toml') ||
           filename.endsWith('.ini');
  }

  private isTestFile(filePath: string): boolean {
    const testPatterns = [
      '.test.', '.spec.', '_test.', '_spec.',
      '__tests__', '__test__', 'test/', 'tests/',
      'spec/', 'specs/', 'e2e/', 'integration/',
      'cypress/', 'jest/', 'mocha/', 'jasmine/',
      'pytest/', 'unittest/', 'doctest/'
    ];
    const lowerPath = filePath.toLowerCase();
    return testPatterns.some(pattern => lowerPath.includes(pattern));
  }

  private isBuildFile(filename: string): boolean {
    const buildFiles = [
      'makefile', 'cmakelists.txt', 'build.gradle',
      'pom.xml', 'build.sbt', 'cargo.toml',
      'webpack.config.js', 'rollup.config.js',
      'vite.config.js', 'gulpfile.js', 'gruntfile.js',
      'dockerfile', 'docker-compose.yml'
    ];
    return buildFiles.includes(filename.toLowerCase());
  }

  private isDocumentationFile(filename: string, extension: string): boolean {
    const docFiles = ['readme', 'license', 'changelog', 'contributing', 'authors', 'install'];
    const docExtensions = ['.md', '.rst', '.txt', '.adoc', '.tex'];
    
    return docFiles.some(doc => filename.toLowerCase().includes(doc)) ||
           docExtensions.includes(extension.toLowerCase());
  }

  private enhanceWithLanguageInfo(structure: FileStructure): void {
    if (structure.type === 'directory' && structure.children) {
      const languages: { [key: string]: number } = {};
      let totalFiles = 0;

      const countLanguages = (node: FileStructure) => {
        if (node.type === 'file' && node.language) {
          languages[node.language] = (languages[node.language] || 0) + 1;
          totalFiles++;
        }
        if (node.children) {
          node.children.forEach(countLanguages);
        }
      };

      structure.children.forEach(countLanguages);

      const languageInfo: LanguageInfo[] = Object.entries(languages)
        .map(([language, count]) => ({
          language,
          fileCount: count,
          percentage: (count / totalFiles) * 100
        }))
        .sort((a, b) => b.fileCount - a.fileCount);

      structure.languageInfo = languageInfo;
      
      // Recursively enhance children
      structure.children.forEach(child => this.enhanceWithLanguageInfo(child));
    }
  }

  getProjectLanguages(structure: FileStructure): string[] {
    if (structure.languageInfo && structure.languageInfo.length > 0) {
      return structure.languageInfo
        .filter((info: LanguageInfo) => info.percentage > 1) // Only languages with > 1% of files
        .map((info: LanguageInfo) => info.language);
    }
    return [];
  }

  getMainLanguage(structure: FileStructure): string | undefined {
    if (structure.languageInfo && structure.languageInfo.length > 0) {
      const firstLanguage = structure.languageInfo[0];
      return firstLanguage ? firstLanguage.language : undefined;
    }
    return undefined;
  }
}
