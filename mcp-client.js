#!/usr/bin/env node

import { spawn } from "child_process";

class MCPClient {
  constructor() {
    this.serverProcess = null;
    this.requestId = 1;
    this.pendingRequests = new Map();
  }

  async connect() {
    console.log("🔌 Connecting to Context Engine MCP Server...\n");

    return new Promise((resolve, reject) => {
      try {
        // Start our local STDIO MCP server
        this.serverProcess = spawn("node", ["dist/index.js"], {
          stdio: ["pipe", "pipe", "pipe"],
        });

        this.serverProcess.stderr.on("data", (data) => {
          const message = data.toString().trim();
          if (message.includes("Context Engine MCP server running")) {
            console.log("✅ Connected successfully!\n");
            resolve(true);
          }
        });

        // Handle JSON-RPC responses from server
        this.serverProcess.stdout.on("data", (data) => {
          const responses = data.toString().trim().split("\n");
          for (const responseText of responses) {
            if (responseText) {
              try {
                const response = JSON.parse(responseText);
                if (response.id && this.pendingRequests.has(response.id)) {
                  const { resolve: resolveRequest } = this.pendingRequests.get(
                    response.id
                  );
                  this.pendingRequests.delete(response.id);
                  resolveRequest(response);
                }
              } catch (e) {
                console.log("Response:", responseText.slice(0, 200) + "...");
              }
            }
          }
        });

        this.serverProcess.on("error", (error) => {
          console.error("❌ Server error:", error);
          reject(error);
        });

        setTimeout(() => {
          reject(new Error("Connection timeout"));
        }, 5000);
      } catch (error) {
        reject(error);
      }
    });
  }

  async sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.requestId++;
      const request = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve, reject });

      // Send JSON-RPC request to our STDIO server
      this.serverProcess.stdin.write(JSON.stringify(request) + "\n");

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("Request timeout"));
        }
      }, 30000);
    });
  }

  async listTools() {
    console.log("🔧 Listing available tools...");

    try {
      const response = await this.sendRequest("tools/list");

      if (response.result && response.result.tools) {
        const tools = response.result.tools;
        console.log(`\n✅ Found ${tools.length} tools:\n`);

        tools.forEach((tool, index) => {
          console.log(`${index + 1}. 📋 ${tool.name}`);
          console.log(`   Description: ${tool.description.slice(0, 80)}...`);
          console.log(
            `   Required: ${tool.inputSchema.required?.join(", ") || "None"}`
          );
          console.log("");
        });

        return tools;
      } else {
        console.log("❌ No tools found in response");
        return [];
      }
    } catch (error) {
      console.error("❌ Failed to list tools:", error.message);
      return [];
    }
  }

  async getProjectSummary(projectPath = process.cwd()) {
    console.log(`📊 Getting project summary: ${projectPath}\n`);

    try {
      const response = await this.sendRequest("tools/call", {
        name: "get_project_summary",
        arguments: {
          projectPath,
        },
      });

      if (
        response.result &&
        response.result.content &&
        response.result.content[0]
      ) {
        const result = JSON.parse(response.result.content[0].text);
        console.log("✅ Project summary completed!\n");

        // Pretty print summary
        console.log("📈 PROJECT SUMMARY");
        console.log("=".repeat(40));
        console.log(`📁 Files: ${result.overview.totalFiles}`);
        console.log(`📂 Directories: ${result.overview.totalDirectories}`);
        console.log(
          `💻 Languages: ${result.overview.mainLanguages.join(", ")}`
        );
        console.log(`🔗 Components: ${result.dependencies.components}`);
        console.log(`🌐 API Endpoints: ${result.apiEndpoints}`);
        console.log(`🔄 Data Flow Nodes: ${result.dataFlow.nodes}`);
        console.log(`⚡ Data Flow Connections: ${result.dataFlow.connections}`);
        console.log("=".repeat(40));

        return result;
      } else {
        console.log("❌ Invalid response format");
        return null;
      }
    } catch (error) {
      console.error("❌ Failed to get project summary:", error.message);
      return null;
    }
  }

  async analyzeProject(projectPath = process.cwd()) {
    console.log(`🔍 Analyzing project: ${projectPath}\n`);

    try {
      const response = await this.sendRequest("tools/call", {
        name: "analyze_project",
        arguments: {
          projectPath,
          options: {
            maxDepth: 3,
            analyzeTests: false,
            analyzeConfig: true,
          },
        },
      });

      if (
        response.result &&
        response.result.content &&
        response.result.content[0]
      ) {
        const result = JSON.parse(response.result.content[0].text);
        console.log("✅ Project analysis completed!\n");
        console.log("📊 Full Analysis Results:");
        console.log("=".repeat(60));
        console.log(JSON.stringify(result, null, 2));
        console.log("=".repeat(60));
        return result;
      } else {
        console.log("❌ Invalid response format");
        return null;
      }
    } catch (error) {
      console.error("❌ Failed to analyze project:", error.message);
      return null;
    }
  }

  async getContextTemplate(projectPath = process.cwd()) {
    console.log(`📝 Generating context template: ${projectPath}\n`);

    try {
      const response = await this.sendRequest("tools/call", {
        name: "get_context_template",
        arguments: {
          projectPath,
          templateOptions: {
            targetSize: 8000,
            includeCode: false,
            focusAreas: ["api", "business-logic", "data-flow"],
          },
        },
      });

      if (
        response.result &&
        response.result.content &&
        response.result.content[0]
      ) {
        const template = response.result.content[0].text;
        console.log("✅ Context template generated!\n");
        console.log("📄 CONTEXT TEMPLATE");
        console.log("=".repeat(60));
        console.log(template);
        console.log("=".repeat(60));
        return template;
      } else {
        console.log("❌ Invalid response format");
        return null;
      }
    } catch (error) {
      console.error("❌ Failed to generate context template:", error.message);
      return null;
    }
  }

  async analyzeFile(filePath, analysisType = "all") {
    console.log(`📄 Analyzing file: ${filePath}\n`);

    try {
      const response = await this.sendRequest("tools/call", {
        name: "analyze_file",
        arguments: {
          filePath,
          analysisType,
        },
      });

      if (
        response.result &&
        response.result.content &&
        response.result.content[0]
      ) {
        const result = JSON.parse(response.result.content[0].text);
        console.log("✅ File analysis completed!\n");
        console.log("📋 File Analysis Results:");
        console.log("=".repeat(50));
        console.log(JSON.stringify(result, null, 2));
        console.log("=".repeat(50));
        return result;
      } else {
        console.log("❌ Invalid response format");
        return null;
      }
    } catch (error) {
      console.error("❌ Failed to analyze file:", error.message);
      return null;
    }
  }

  async disconnect() {
    try {
      if (this.serverProcess) {
        this.serverProcess.kill();
        console.log("\n🔌 Disconnected from MCP server");
      }
    } catch (error) {
      console.error("❌ Error disconnecting:", error.message);
    }
  }

  async runDemo() {
    console.log("🚀 Context Engine MCP Client - Full Demo\n");

    // 1. List tools
    await this.listTools();

    // 2. Get project summary
    await this.getProjectSummary();

    // 3. Generate context template
    await this.getContextTemplate();

    // 4. Analyze a specific file
    await this.analyzeFile("./src/index.ts", "components");

    console.log("\n🎉 Demo completed!");
  }
}

async function main() {
  const client = new MCPClient();

  try {
    const args = process.argv.slice(2);

    // Connect to our local STDIO server
    await client.connect();

    if (args.length === 0 || args[0] === "demo") {
      // Run full demo
      await client.runDemo();
    } else {
      // Handle specific commands
      switch (args[0]) {
        case "list-tools":
          await client.listTools();
          break;
        case "summary":
          const summaryPath = args[1] || process.cwd();
          await client.getProjectSummary(summaryPath);
          break;
        case "analyze":
          const projectPath = args[1] || process.cwd();
          await client.analyzeProject(projectPath);
          break;
        case "template":
          const templatePath = args[1] || process.cwd();
          await client.getContextTemplate(templatePath);
          break;
        case "analyze-file":
          if (args[1]) {
            await client.analyzeFile(args[1], args[2] || "all");
          } else {
            console.log("❌ Please provide a file path");
          }
          break;
        default:
          console.log("❌ Unknown command. Available commands:");
          console.log("  demo (default) - Run full demonstration");
          console.log("  list-tools - List available MCP tools");
          console.log("  summary [path] - Get project summary");
          console.log("  analyze [path] - Full project analysis");
          console.log("  template [path] - Generate context template");
          console.log(
            "  analyze-file <file-path> [type] - Analyze specific file"
          );
      }
    }

    await client.disconnect();
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

// Handle process termination
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down...");
  process.exit(0);
});

// Run the client
main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
