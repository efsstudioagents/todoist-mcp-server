import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest, handleApiError } from "../client.js";
import { ResponseFormat } from "../constants.js";
import type { Label } from "../types.js";

function formatLabel(label: Label): string {
  return [
    `## ${label.name} (${label.id})`,
    `- **Color:** ${label.color}`,
    `- **Order:** ${label.order}`,
    `- **Favorite:** ${label.is_favorite}`,
  ].join("\n");
}

export function registerLabelTools(server: McpServer): void {
  server.registerTool(
    "todoist_list_labels",
    {
      title: "List Todoist Labels",
      description: `List all personal labels in Todoist.

Args:
  - response_format ('markdown'|'json'): Output format (default: 'markdown')

Returns: Array of label objects.`,
      inputSchema: z.object({
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN).describe("Output format"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const labels = await apiRequest<Label[]>("labels");

        if (!labels.length) {
          return { content: [{ type: "text", text: "No labels found." }] };
        }

        const text = params.response_format === ResponseFormat.JSON
          ? JSON.stringify({ count: labels.length, labels }, null, 2)
          : [`# Labels (${labels.length})`, "", ...labels.map(formatLabel)].join("\n\n");

        return {
          content: [{ type: "text", text }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "todoist_get_label",
    {
      title: "Get Todoist Label",
      description: `Get a single label by ID.

Args:
  - label_id (string): Label ID
  - response_format ('markdown'|'json'): Output format (default: 'markdown')`,
      inputSchema: z.object({
        label_id: z.string().describe("Label ID"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN).describe("Output format"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const label = await apiRequest<Label>(`labels/${params.label_id}`);
        const text = params.response_format === ResponseFormat.JSON
          ? JSON.stringify(label, null, 2)
          : formatLabel(label);
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "todoist_create_label",
    {
      title: "Create Todoist Label",
      description: `Create a new personal label.

Args:
  - name (string, required): Label name
  - color (string, optional): Color name e.g. "red", "blue"
  - order (integer, optional): Position in label list
  - is_favorite (boolean, optional): Mark as favorite

Returns: Created label object.`,
      inputSchema: z.object({
        name: z.string().min(1).describe("Label name"),
        color: z.string().optional().describe("Color name"),
        order: z.number().int().optional().describe("Position in label list"),
        is_favorite: z.boolean().optional().describe("Mark as favorite"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) => {
      try {
        const body: Record<string, unknown> = { name: params.name };
        if (params.color !== undefined) body.color = params.color;
        if (params.order !== undefined) body.order = params.order;
        if (params.is_favorite !== undefined) body.is_favorite = params.is_favorite;

        const label = await apiRequest<Label>("labels", "POST", body);
        return {
          content: [{ type: "text", text: `Label created!\n\n${formatLabel(label)}` }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "todoist_update_label",
    {
      title: "Update Todoist Label",
      description: `Update an existing label.

Args:
  - label_id (string, required): Label ID to update
  - name (string, optional): New label name
  - color (string, optional): New color name
  - order (integer, optional): New position
  - is_favorite (boolean, optional): Toggle favorite

Returns: Updated label object.`,
      inputSchema: z.object({
        label_id: z.string().describe("Label ID to update"),
        name: z.string().optional().describe("New label name"),
        color: z.string().optional().describe("New color name"),
        order: z.number().int().optional().describe("New position"),
        is_favorite: z.boolean().optional().describe("Toggle favorite"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) => {
      try {
        const { label_id, ...fields } = params;
        const body: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(fields)) {
          if (value !== undefined) body[key] = value;
        }

        const label = await apiRequest<Label>(`labels/${label_id}`, "POST", body);
        return {
          content: [{ type: "text", text: `Label updated!\n\n${formatLabel(label)}` }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "todoist_delete_label",
    {
      title: "Delete Todoist Label",
      description: `Delete a personal label. Tasks that had this label will lose it.

Args:
  - label_id (string, required): Label ID to delete`,
      inputSchema: z.object({
        label_id: z.string().describe("Label ID to delete"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (params) => {
      try {
        await apiRequest(`labels/${params.label_id}`, "DELETE");
        return { content: [{ type: "text", text: `Label ${params.label_id} deleted.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
