# Context Engine MCP Server v2.0

A **production-ready TypeScript MCP server** that provides comprehensive project analysis, intelligent code search, dependency tracking, and coordinated multi-file editing capabilities.

## 🚀 Features

### Core Capabilities

- **🔍 Intelligent Project Analysis**: Deep code structure analysis with dependency tracking
- **📊 Multi-Language Support**: JavaScript, TypeScript, Python, Java, C#, C++, and more
- **⚡ Smart Caching**: LRU cache with automatic cleanup and memory management
- **🔒 Security First**: Input validation, path traversal protection, and error handling
- **📝 Multi-File Editing**: Coordinated file operations with automatic backups
- **🔗 Dependency Mapping**: Comprehensive file relationship analysis
- **📈 Project Statistics**: Code health metrics and performance insights

### Advanced Features

- **Intelligent Search**: Regex-based search with code structure awareness
- **Framework Detection**: Automatic detection of React, Vue, Django, Express, etc.
- **Backup System**: Automatic file backups before modifications
- **Performance Monitoring**: Built-in logging and performance tracking
- **Memory Management**: Configurable limits and automatic cleanup
- **Error Recovery**: Comprehensive error handling with rollback capabilities

## 📋 Requirements

- **Node.js**: 18.0.0 or higher
- **TypeScript**: 5.3.3 or higher
- **Memory**: Recommended 512MB+ for large projects

## 🛠 Installation

### From NPM (Recommended)

```bash
npm install -g context-engine-mcp-server
```

### From Source

```bash
git clone https://github.com/RaheesAhmed/Context-Engine-MCP-Server.git
cd Context-Engine-MCP-Server
npm install
npm run build
npm link
```

### Development Setup

```bash
git clone https://github.com/RaheesAhmed/Context-Engine-MCP-Server.git
cd Context-Engine-MCP-Server
npm install
npm run dev
```

## 🏃 Quick Start

### 1. Configure MCP Client

#### For Claude Desktop

Add to your `claude_desktop_config.json`:

**macOS/Linux:**

```bash
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows:**

```bash
code %APPDATA%\Claude\claude_desktop_config.json
```

**Configuration:**

```json
{
  "mcpServers": {
    "context-engine": {
      "command": "node",
      "args": ["/absolute/path/to/context-engine/dist/index.js"]
    }
  }
}
```

**Example for typical installation:**

```json
{
  "mcpServers": {
    "context-engine": {
      "command": "node",
      "args": ["d:/mcp-servers/context-engine/dist/index.js"]
    }
  }
}
```

#### For Other MCP Clients

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "context-engine": {
      "command": "node",
      "args": ["/absolute/path/to/context-engine/dist/index.js"]
    }
  }
}
```

**Note:** Use the full absolute path to your `dist/index.js` file. If you've installed globally with `npm install -g .`, you can use `"command": "context-engine-mcp"` with `"args": []` instead.

#### Verify Installation

Test the server is working correctly:

```bash
# Test basic functionality
context-engine-mcp --help

# Or run directly
node ./dist/index.js
```

### 2. Basic Usage

#### Analyze a Project

```bash
# Analyze project structure and dependencies
analyze_project {
  "projectPath": "/path/to/your/project",
  "forceRefresh": false
}
```

#### Search Code

```bash
# Intelligent search across all files
search_project {
  "projectPath": "/path/to/your/project",
  "query": "function handleSubmit",
  "caseSensitive": false,
  "includeStructure": true
}
```

#### Edit Multiple Files

```bash
# Coordinated multi-file editing with backups
edit_multiple_files {
  "projectPath": "/path/to/your/project",
  "changes": [
    {
      "filePath": "src/components/Header.tsx",
      "action": "update",
      "content": "// Updated header component..."
    },
    {
      "filePath": "src/styles/header.css",
      "action": "create",
      "content": ".header { color: blue; }"
    }
  ]
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Logging level (debug, info, warn, error)
LOG_LEVEL=info

# Maximum file size in bytes (default: 10MB)
MAX_FILE_SIZE=10485760

# Cache cleanup interval in ms (default: 5 minutes)
CACHE_CLEANUP_INTERVAL=300000

# Maximum cache entries (default: 1000)
MAX_CACHE_SIZE=1000
```

### Programmatic Configuration

```typescript
import { configManager } from 'context-engine-mcp-server/config';

configManager.update({
  maxFileSize: 20 * 1024 * 1024, // 20MB
  logLevel: 'debug',
  maxCacheSize: 2000,
});
```

## 📚 Available Tools

### `analyze_project`

Comprehensively analyze project structure and dependencies.

**Parameters:**

- `projectPath` (string, required): Path to project directory
- `forceRefresh` (boolean, optional): Bypass cache and force fresh analysis

**Returns:** Complete project context with file analysis, dependencies, and metadata.

### `search_project`

Intelligent search across project files with structure awareness.

**Parameters:**

- `projectPath` (string, required): Path to analyzed project
- `query` (string, required): Search query (supports regex)
- `caseSensitive` (boolean, optional): Case-sensitive search
- `includeStructure` (boolean, optional): Include functions/classes in search
- `filePatterns` (string[], optional): Filter files by patterns
- `maxResults` (number, optional): Maximum results to return

**Returns:** Search results with file locations and context.

### `edit_multiple_files`

Edit multiple files simultaneously with coordinated changes.

**Parameters:**

- `projectPath` (string, required): Path to project directory
- `changes` (FileChange[], required): Array of file operations

**FileChange Object:**

- `filePath` (string): Relative path within project
- `action` ('create' | 'update' | 'delete'): Operation type
- `content` (string, optional): File content for create/update
- `backup` (boolean, optional): Create backup (default: true)

**Returns:** Results of each file operation with success/error status.

### `get_file_relationships`

Analyze file dependencies and relationships.

**Parameters:**

- `projectPath` (string, required): Path to analyzed project
- `filePath` (string, optional): Specific file to analyze

**Returns:** Dependency mapping showing imports and dependents.

### `get_project_stats`

Generate comprehensive project statistics and health metrics.

**Parameters:**

- `projectPath` (string, required): Path to analyzed project

**Returns:** Detailed statistics including code health, dependencies, and performance metrics.

### `get_project_context`

Retrieve cached project context without re-analysis.

**Parameters:**

- `projectPath` (string, required): Path to previously analyzed project

**Returns:** Cached project context and metadata.

### `clear_cache`

Clear all cached data and force fresh analysis.

**Parameters:** None

**Returns:** Confirmation of cache clearing.

## 🏗 Architecture

### Core Components

```
src/
├── config/           # Configuration management
├── services/         # Core business logic
│   ├── context-engine.ts    # Main orchestration service
│   ├── file-manager.ts      # File operations & validation
│   ├── language-analyzer.ts # Code parsing & analysis
│   └── cache-manager.ts     # Intelligent caching system
├── utils/           # Utility functions
│   ├── errors.ts          # Error handling & types
│   ├── validation.ts      # Input validation & security
│   └── logger.ts          # Structured logging
├── types/           # TypeScript type definitions
└── index.ts         # MCP server entry point
```

### Key Design Patterns

- **Singleton Pattern**: Ensures single instances of core services
- **Factory Pattern**: Creates configured service instances
- **Observer Pattern**: Cache cleanup and memory management
- **Strategy Pattern**: Language-specific analysis strategies
- **Command Pattern**: File operation coordination

## 📊 Performance

### Benchmarks

- **Small Projects** (< 100 files): < 2 seconds
- **Medium Projects** (100-1000 files): < 10 seconds
- **Large Projects** (1000+ files): < 30 seconds
- **Memory Usage**: ~50MB base + ~1MB per 100 files analyzed
- **Cache Hit Rate**: 85-95% for repeated operations

### Optimization Features

- **Batched Processing**: Files processed in configurable batches
- **Intelligent Caching**: LRU cache with TTL and size limits
- **Memory Management**: Automatic cleanup and garbage collection
- **Lazy Loading**: On-demand analysis and loading
- **Performance Monitoring**: Built-in metrics and logging

## 🔒 Security

### Security Features

- **Input Validation**: Zod schemas for all inputs
- **Path Traversal Protection**: Prevents directory escapes
- **File Size Limits**: Configurable maximum file sizes
- **Regex DoS Protection**: Validates search patterns
- **Error Sanitization**: Prevents information leakage
- **Backup System**: Automatic file backups before changes

### Best Practices

- All file operations are sandboxed within project boundaries
- Comprehensive error handling prevents crashes
- Structured logging for security monitoring
- Input sanitization and validation at all entry points

## 🐛 Troubleshooting

### Common Issues

**Project Analysis Fails**

```bash
# Check file permissions
ls -la /path/to/project

# Verify path exists and is readable
analyze_project { "projectPath": "/absolute/path/to/project" }
```

**Memory Issues with Large Projects**

```bash
# Increase cache cleanup frequency
export CACHE_CLEANUP_INTERVAL=60000

# Reduce cache size
export MAX_CACHE_SIZE=500
```

**Performance Issues**

```bash
# Enable debug logging
export LOG_LEVEL=debug

# Monitor performance
get_project_stats { "projectPath": "/path/to/project" }
```

### Debug Mode

```bash
# Enable verbose logging
LOG_LEVEL=debug context-engine-mcp

# Check cache statistics
clear_cache
```

## 🤝 Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and add tests
4. Run tests: `npm test`
5. Run linting: `npm run lint`
6. Commit changes: `git commit -m 'Add amazing feature'`
7. Push to branch: `git push origin feature/amazing-feature`
8. Create Pull Request

### Code Standards

- **TypeScript**: Strict mode enabled with comprehensive types
- **ESLint**: Enforced code quality and consistency
- **Prettier**: Automatic code formatting
- **Testing**: Unit and integration tests for all features
- **Documentation**: Comprehensive inline and API documentation

## 📝 Changelog

### Version 2.0.0 (Current)

- **Complete TypeScript rewrite** for production readiness
- **Modular architecture** with separated concerns
- **Enhanced security** with comprehensive validation
- **Improved performance** with intelligent caching
- **Advanced error handling** with structured logging
- **Multi-file editing** with atomic operations
- **Comprehensive testing** suite and coverage

### Version 1.0.0 (Legacy)

- Initial JavaScript implementation
- Basic project analysis
- Simple file operations
- Limited error handling

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- Powered by [TypeScript](https://www.typescriptlang.org/)
- Uses [Zod](https://zod.dev/) for runtime validation
- Logging via [Winston](https://github.com/winstonjs/winston)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/raheesahmed/context-engine-mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/raheesahmed/context-engine-mcp/discussions)
- **Email**: raheesahmed256@gmail.com

---

**Context Engine MCP Server v2.0** - Intelligent project analysis and code manipulation for the AI era.
