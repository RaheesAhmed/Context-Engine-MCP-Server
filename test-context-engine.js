#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testContextEngine() {
  console.log('🚀 Testing Context Engine MCP Server...');

  // Create transport to connect to the built server
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
  });

  // Create client
  const client = new Client({
    name: 'context-engine-test-client',
    version: '1.0.0',
  });

  try {
    console.log('🔗 Connecting to Context Engine server...');
    await client.connect(transport);
    console.log('✅ Connected successfully!');

    // Test 1: List available tools
    console.log('\n📋 Listing available tools...');
    const tools = await client.listTools();
    console.log('Available tools:');
    tools.tools.forEach(t => console.log(`  • ${t.name}: ${t.description}`));

    // Test 2: List available resources
    console.log('\n📚 Listing available resources...');
    const resources = await client.listResources();
    console.log('Available resources:');
    resources.resources.forEach(r => console.log(`  • ${r.name}: ${r.description}`));

    // Test 3: Call the clear_cache tool (simple test)
    console.log('\n🗑️ Testing clear_cache tool...');
    const clearResult = await client.callTool({
      name: 'clear_cache',
      arguments: {},
    });
    console.log('Clear cache result:', clearResult.content[0].text);

    console.log('\n🎉 Context Engine MCP Server is working correctly!');
    console.log('\nYou can now use this server with Claude Desktop or other MCP clients.');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  } finally {
    // Clean up
    try {
      await client.close();
      console.log('🔌 Client disconnected');
    } catch (e) {
      console.error('Error closing client:', e.message);
    }
  }
}

// Run the test
testContextEngine().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
