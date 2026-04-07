import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest, handleApiError } from "../client.js";
import { ResponseFormat } from "../constants.js";
import type { Project } from "../types.js";

function formatProject(project: Project): string {
  const lines = [
    `## ${project.name} (${project.id})`,
    `- **Color:** ${project.color}`,
    `- **View:** ${project.view_style}`,
    `- **Shared:** ${project.is_shared}`,
    `- **Favorite:** ${project.is_favorite}`,
    `- **Inbox:** ${project.is_inbox_project}`,
    `- **Comments:** ${project.comment_count}`,
    `- **URL:** ${project.url}`,
  ];
  if (project.parent_id) lines.push(`- **Parent project:** ${project.parent_id}`);
  return lines.join("\n");
}

export function registerProjectTools(server: McpServer): void {
  // List projects
  server.registerTool(
    "todoist_list_projects",
    {
      title: "List Todoist Projects",
      description: `List all projects in Todoist.

Args:
  - response_format ('markdown'|'json'): Output format (default: 'markdown')

Returns: Array of project objects.`,
      inputSchema: z.object({
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN).describe("Output format"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const projects = await apiRequest<Project[]>("projects");

        if (!projects.length) {
          return { content: [{ type: "text", text: "No projects found." }] };
        }

        const text = params.response_format === ResponseFormat.JSON
          ? JSON.stringify({ count: projects.length, projects }, null, 2)
          : [`# Projects (${projects.length})`, "", ...projects.map(formatProject)].join("\n\n");

        return {
          content: [{ type: "text", text }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Get project
  server.registerTool(
    "todoist_get_project",
    {
      title: "Get Todoist Project",
      description: `Get a single Todoist project by ID.

Args:
  - project_id (string): Project ID
  - response_format ('markdown'|'json'): Output format (default: 'markdown')

Returns: Project object.`,
      inputSchema: z.object({
        project_id: z.string().describe("Project ID"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN).describe("Output format"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const project = await apiRequest<Project>(`projects/${params.project_id}`);
        const text = params.response_format === ResponseFormat.JSON
          ? JSON.stringify(project, null, 2)
          : formatProject(project);
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Create project
  server.registerTool(
    "todoist_create_project",
    {
      title: "Create Todoist Project",
      description: `Create a new Todoist project.

Args:
  - name (string, required): Project name
  - color (string, optional): Color name e.g. "red", "blue", "green"
  - parent_id (string, optional): Parent project ID for sub-project
  - is_favorite (boolean, optional): Mark as favorite
  - view_style (string, optional): "list" or "board"

Returns: Created project object.`,
      inputSchema: z.object({
        name: z.string().min(1).describe("Project name"),
        color: z.string().optional().describe('Color name e.g. "red", "blue"'),
        parent_id: z.string().optional().describe("Parent project ID"),
        is_favorite: z.boolean().optional().describe("Mark as favorite"),
        view_style: z.enum(["list", "board"]).optional().describe("View style"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) => {
      try {
        const body: Record<string, unknown> = { name: params.name };
        if (params.color !== undefined) body.color = params.color;
        if (params.parent_id !== undefined) body.parent_id = params.parent_id;
        if (params.is_favorite !== undefined) body.is_favorite = params.is_favorite;
        if (params.view_style !== undefined) body.view_style = params.view_style;

        const project = await apiRequest<Project>("projects", "POST", body);
        return {
          content: [{ type: "text", text: `Project created!\n\n${formatProject(project)}` }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Update project
  server.registerTool(
    "todoist_update_project",
    {
      title: "Update Todoist Project",
      description: `Update an existing Todoist project. Only provided fields are updated.

Args:
  - project_id (string, required): Project ID to update
  - name (string, optional): New project name
  - color (string, optional): New color name
  - is_favorite (boolean, optional): Toggle favorite
  - view_style (string, optional): "list" or "board"

Returns: Updated project object.`,
      inputSchema: z.object({
        project_id: z.string().describe("Project ID to update"),
        name: z.string().optional().describe("New project name"),
        color: z.string().optional().describe("New color name"),
        is_favorite: z.boolean().optional().describe("Toggle favorite"),
        view_style: z.enum(["list", "board"]).optional().describe("View style"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) => {
      try {
        const { project_id, ...fields } = params;
        const body: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(fields)) {
          if (value !== undefined) body[key] = value;
        }

        const project = await apiRequest<Project>(`projects/${project_id}`, "POST", body);
        return {
          content: [{ type: "text", text: `Project updated!\n\n${formatProject(project)}` }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Delete project
  server.registerTool(
    "todoist_delete_project",
    {
      title: "Delete Todoist Project",
      description: `Permanently delete a Todoist project and all its tasks. This cannot be undone.

Args:
  - project_id (string, required): Project ID to delete

Returns: Confirmation message.`,
      inputSchema: z.object({
        project_id: z.string().describe("Project ID to delete"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (params) => {
      try {
        await apiRequest(`projects/${params.project_id}`, "DELETE");
        return { content: [{ type: "text", text: `Project ${params.project_id} deleted.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
