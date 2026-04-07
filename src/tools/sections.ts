import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest, handleApiError } from "../client.js";
import { ResponseFormat } from "../constants.js";
import type { Section } from "../types.js";

function formatSection(section: Section): string {
  return [
    `## ${section.name} (${section.id})`,
    `- **Project:** ${section.project_id}`,
    `- **Order:** ${section.order}`,
  ].join("\n");
}

export function registerSectionTools(server: McpServer): void {
  server.registerTool(
    "todoist_list_sections",
    {
      title: "List Todoist Sections",
      description: `List sections, optionally filtered by project.

Args:
  - project_id (string, optional): Filter by project ID
  - response_format ('markdown'|'json'): Output format (default: 'markdown')

Returns: Array of section objects.`,
      inputSchema: z.object({
        project_id: z.string().optional().describe("Filter by project ID"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN).describe("Output format"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const queryParams: Record<string, unknown> = {};
        if (params.project_id) queryParams.project_id = params.project_id;

        const sections = await apiRequest<Section[]>("sections", "GET", undefined, queryParams);

        if (!sections.length) {
          return { content: [{ type: "text", text: "No sections found." }] };
        }

        const text = params.response_format === ResponseFormat.JSON
          ? JSON.stringify({ count: sections.length, sections }, null, 2)
          : [`# Sections (${sections.length})`, "", ...sections.map(formatSection)].join("\n\n");

        return {
          content: [{ type: "text", text }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "todoist_get_section",
    {
      title: "Get Todoist Section",
      description: `Get a single section by ID.

Args:
  - section_id (string): Section ID
  - response_format ('markdown'|'json'): Output format (default: 'markdown')`,
      inputSchema: z.object({
        section_id: z.string().describe("Section ID"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN).describe("Output format"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const section = await apiRequest<Section>(`sections/${params.section_id}`);
        const text = params.response_format === ResponseFormat.JSON
          ? JSON.stringify(section, null, 2)
          : formatSection(section);
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "todoist_create_section",
    {
      title: "Create Todoist Section",
      description: `Create a new section within a project.

Args:
  - name (string, required): Section name
  - project_id (string, required): Project ID
  - order (integer, optional): Position within the project

Returns: Created section object.`,
      inputSchema: z.object({
        name: z.string().min(1).describe("Section name"),
        project_id: z.string().describe("Project ID"),
        order: z.number().int().optional().describe("Position within project"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) => {
      try {
        const body: Record<string, unknown> = { name: params.name, project_id: params.project_id };
        if (params.order !== undefined) body.order = params.order;

        const section = await apiRequest<Section>("sections", "POST", body);
        return {
          content: [{ type: "text", text: `Section created!\n\n${formatSection(section)}` }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "todoist_update_section",
    {
      title: "Update Todoist Section",
      description: `Rename a section.

Args:
  - section_id (string, required): Section ID to update
  - name (string, required): New section name

Returns: Updated section object.`,
      inputSchema: z.object({
        section_id: z.string().describe("Section ID to update"),
        name: z.string().min(1).describe("New section name"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) => {
      try {
        const section = await apiRequest<Section>(`sections/${params.section_id}`, "POST", { name: params.name });
        return {
          content: [{ type: "text", text: `Section updated!\n\n${formatSection(section)}` }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "todoist_delete_section",
    {
      title: "Delete Todoist Section",
      description: `Delete a section and all its tasks. This cannot be undone.

Args:
  - section_id (string, required): Section ID to delete`,
      inputSchema: z.object({
        section_id: z.string().describe("Section ID to delete"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (params) => {
      try {
        await apiRequest(`sections/${params.section_id}`, "DELETE");
        return { content: [{ type: "text", text: `Section ${params.section_id} deleted.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
