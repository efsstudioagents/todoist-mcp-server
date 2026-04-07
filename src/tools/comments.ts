import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest, handleApiError } from "../client.js";
import { ResponseFormat } from "../constants.js";
import type { Comment } from "../types.js";

function formatComment(comment: Comment): string {
  const lines = [
    `## Comment (${comment.id})`,
    `- **Posted:** ${comment.posted_at}`,
    `- **Content:** ${comment.content}`,
  ];
  if (comment.task_id) lines.push(`- **Task:** ${comment.task_id}`);
  if (comment.project_id) lines.push(`- **Project:** ${comment.project_id}`);
  if (comment.attachment) {
    lines.push(`- **Attachment:** [${comment.attachment.file_name}](${comment.attachment.file_url})`);
  }
  return lines.join("\n");
}

export function registerCommentTools(server: McpServer): void {
  server.registerTool(
    "todoist_list_comments",
    {
      title: "List Todoist Comments",
      description: `List comments on a task or project. One of task_id or project_id must be provided.

Args:
  - task_id (string, optional): Task ID to get comments for
  - project_id (string, optional): Project ID to get comments for
  - response_format ('markdown'|'json'): Output format (default: 'markdown')

Returns: Array of comment objects.`,
      inputSchema: z.object({
        task_id: z.string().optional().describe("Task ID"),
        project_id: z.string().optional().describe("Project ID"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN).describe("Output format"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        if (!params.task_id && !params.project_id) {
          return { content: [{ type: "text", text: "Error: Either task_id or project_id must be provided." }] };
        }

        const queryParams: Record<string, unknown> = {};
        if (params.task_id) queryParams.task_id = params.task_id;
        if (params.project_id) queryParams.project_id = params.project_id;

        const comments = await apiRequest<Comment[]>("comments", "GET", undefined, queryParams);

        if (!comments.length) {
          return { content: [{ type: "text", text: "No comments found." }] };
        }

        const text = params.response_format === ResponseFormat.JSON
          ? JSON.stringify({ count: comments.length, comments }, null, 2)
          : [`# Comments (${comments.length})`, "", ...comments.map(formatComment)].join("\n\n");

        return {
          content: [{ type: "text", text }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "todoist_get_comment",
    {
      title: "Get Todoist Comment",
      description: `Get a single comment by ID.

Args:
  - comment_id (string): Comment ID
  - response_format ('markdown'|'json'): Output format (default: 'markdown')`,
      inputSchema: z.object({
        comment_id: z.string().describe("Comment ID"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN).describe("Output format"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const comment = await apiRequest<Comment>(`comments/${params.comment_id}`);
        const text = params.response_format === ResponseFormat.JSON
          ? JSON.stringify(comment, null, 2)
          : formatComment(comment);
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "todoist_create_comment",
    {
      title: "Create Todoist Comment",
      description: `Add a comment to a task or project. One of task_id or project_id must be provided.

Args:
  - content (string, required): Comment text (supports Markdown)
  - task_id (string, optional): Task to comment on
  - project_id (string, optional): Project to comment on

Returns: Created comment object.`,
      inputSchema: z.object({
        content: z.string().min(1).describe("Comment text"),
        task_id: z.string().optional().describe("Task ID to comment on"),
        project_id: z.string().optional().describe("Project ID to comment on"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) => {
      try {
        if (!params.task_id && !params.project_id) {
          return { content: [{ type: "text", text: "Error: Either task_id or project_id must be provided." }] };
        }

        const body: Record<string, unknown> = { content: params.content };
        if (params.task_id) body.task_id = params.task_id;
        if (params.project_id) body.project_id = params.project_id;

        const comment = await apiRequest<Comment>("comments", "POST", body);
        return {
          content: [{ type: "text", text: `Comment added!\n\n${formatComment(comment)}` }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "todoist_update_comment",
    {
      title: "Update Todoist Comment",
      description: `Update the content of a comment.

Args:
  - comment_id (string, required): Comment ID to update
  - content (string, required): New comment text

Returns: Updated comment object.`,
      inputSchema: z.object({
        comment_id: z.string().describe("Comment ID to update"),
        content: z.string().min(1).describe("New comment text"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) => {
      try {
        const comment = await apiRequest<Comment>(`comments/${params.comment_id}`, "POST", { content: params.content });
        return {
          content: [{ type: "text", text: `Comment updated!\n\n${formatComment(comment)}` }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "todoist_delete_comment",
    {
      title: "Delete Todoist Comment",
      description: `Delete a comment. This cannot be undone.

Args:
  - comment_id (string, required): Comment ID to delete`,
      inputSchema: z.object({
        comment_id: z.string().describe("Comment ID to delete"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (params) => {
      try {
        await apiRequest(`comments/${params.comment_id}`, "DELETE");
        return { content: [{ type: "text", text: `Comment ${params.comment_id} deleted.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
