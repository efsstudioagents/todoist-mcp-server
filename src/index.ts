#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initClient } from "./client.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerSectionTools } from "./tools/sections.js";
import { registerLabelTools } from "./tools/labels.js";
import { registerCommentTools } from "./tools/comments.js";

const token = process.env.TODOIST_API_TOKEN;
if (!token) {
  console.error("ERROR: TODOIST_API_TOKEN environment variable is required");
  process.exit(1);
}

initClient(token);

const server = new McpServer({
  name: "todoist-mcp-server",
  version: "1.0.0",
});

registerTaskTools(server);
registerProjectTools(server);
registerSectionTools(server);
registerLabelTools(server);
registerCommentTools(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Todoist MCP server running via stdio");
}

main().catch((error: unknown) => {
  console.error("Server error:", error);
  process.exit(1);
});
