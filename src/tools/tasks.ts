import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest, handleApiError } from "../client.js";
import { CHARACTER_LIMIT, ResponseFormat } from "../constants.js";
import type { Task } from "../types.js";

function formatTask(task: Task): string {
  const lines = [
    `## ${task.content} (${task.id})`,
    `- **Project:** ${task.project_id}`,
    `- **Priority:** ${task.priority}`,
    `- **Completed:** ${task.is_completed}`,
  ];
  if (task.description) lines.push(`- **Description:** ${task.description}`);
  if (task.due) lines.push(`- **Due:** ${task.due.string}${task.due.datetime ? ` (${task.due.datetime})` : ""}`);
  if (task.labels.length > 0) lines.push(`- **Labels:** ${task.labels.join(", ")}`);
  if (task.section_id) lines.push(`- **Section:** ${task.section_id}`);
  if (task.parent_id) lines.push(`- **Parent task:** ${task.parent_id}`);
  if (task.assignee_id) lines.push(`- **Assignee:** ${task.assignee_id}`);
  lines.push(`- **Created:** ${task.created_at}`);
  lines.push(`- **URL:** ${task.url}`);
  return lines.join("\n");
}

export function registerTaskTools(server: McpServer): void {
  // List tasks
  server.registerTool(
    "todoist_list_tasks",
    {
      title: "List Todoist Tasks",
      description: `List active tasks from Todoist with optional filters.

Returns tasks filtered by project, section, label, or a natural language filter string.

Args:
  - project_id (string, optional): Filter tasks by project ID
  - section_id (string, optional): Filter tasks by section ID
  - label (string, optional): Filter tasks by label name
  - filter (string, optional): Natural language filter e.g. "today", "overdue", "p1"
  - cursor (string, optional): Pagination cursor from previous response
  - limit (integer, optional): Max tasks to return (1-200, default 50)
  - response_format ('markdown'|'json'): Output format (default: 'markdown')

Returns: List of task objects with id, content, description, priority, due date, labels, etc.`,
      inputSchema: z.object({
        project_id: z.string().optional().describe("Filter by project ID"),
        section_id: z.string().optional().describe("Filter by section ID"),
        label: z.string().optional().describe("Filter by label name"),
        filter: z.string().optional().describe('Natural language filter e.g. "today", "overdue", "p1"'),
        cursor: z.string().optional().describe("Pagination cursor"),
        limit: z.number().int().min(1).max(200).default(50).describe("Max results (default 50)"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN).describe("Output format"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const queryParams: Record<string, unknown> = { limit: params.limit };
        if (params.project_id) queryParams.project_id = params.project_id;
        if (params.section_id) queryParams.section_id = params.section_id;
        if (params.label) queryParams.label = params.label;
        if (params.filter) queryParams.filter = params.filter;
        if (params.cursor) queryParams.cursor = params.cursor;

        const data = await apiRequest<{ items?: Task[]; results?: Task[]; next_cursor?: string }>(
          "tasks", "GET", undefined, queryParams
        );

        const tasks: Task[] = data.items ?? (data as unknown as Task[]) ?? [];
        const nextCursor = data.next_cursor;

        if (!tasks.length) {
          return { content: [{ type: "text", text: "No tasks found." }] };
        }

        const output = {
          count: tasks.length,
          has_more: !!nextCursor,
          next_cursor: nextCursor,
          tasks: tasks.map((t) => ({
            id: t.id, content: t.content, description: t.description,
            project_id: t.project_id, section_id: t.section_id, parent_id: t.parent_id,
            priority: t.priority, labels: t.labels, due: t.due, is_completed: t.is_completed,
            url: t.url, created_at: t.created_at,
          })),
        };

        let text: string;
        if (params.response_format === ResponseFormat.JSON) {
          text = JSON.stringify(output, null, 2);
        } else {
          const lines = [`# Tasks (${tasks.length})`, ""];
          for (const task of tasks) lines.push(formatTask(task), "");
          if (nextCursor) lines.push(`---`, `*More results available. Use cursor: \`${nextCursor}\`*`);
          text = lines.join("\n");
        }

        if (text.length > CHARACTER_LIMIT) {
          text = text.slice(0, CHARACTER_LIMIT) + "\n\n[Response truncated — use filters or pagination to narrow results]";
        }

        return { content: [{ type: "text", text }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Get task
  server.registerTool(
    "todoist_get_task",
    {
      title: "Get Todoist Task",
      description: `Get a single Todoist task by ID.

Args:
  - task_id (string): The task ID
  - response_format ('markdown'|'json'): Output format (default: 'markdown')

Returns: Full task object.`,
      inputSchema: z.object({
        task_id: z.string().describe("Task ID"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN).describe("Output format"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const task = await apiRequest<Task>(`tasks/${params.task_id}`);
        const text = params.response_format === ResponseFormat.JSON
          ? JSON.stringify(task, null, 2)
          : formatTask(task);
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Create task
  server.registerTool(
    "todoist_create_task",
    {
      title: "Create Todoist Task",
      description: `Create a new task in Todoist.

Args:
  - content (string, required): Task title — supports Markdown inline formatting
  - description (string, optional): Task description
  - project_id (string, optional): Project ID — defaults to Inbox if omitted
  - section_id (string, optional): Section ID within the project
  - parent_id (string, optional): Parent task ID to create as subtask
  - labels (array[string], optional): Label names to apply
  - priority (integer, optional): 1=normal, 2=medium, 3=high, 4=urgent
  - due_string (string, optional): Human due date e.g. "tomorrow", "next monday at 3pm"
  - due_date (string, optional): Due date in YYYY-MM-DD format
  - due_datetime (string, optional): Due datetime in RFC3339 format
  - assignee_id (string, optional): User ID to assign (shared projects only)
  - duration (integer, optional): Duration amount
  - duration_unit (string, optional): "minute" or "day"

Returns: Created task object.`,
      inputSchema: z.object({
        content: z.string().min(1).describe("Task title"),
        description: z.string().optional().describe("Task description"),
        project_id: z.string().optional().describe("Project ID (defaults to Inbox)"),
        section_id: z.string().optional().describe("Section ID"),
        parent_id: z.string().optional().describe("Parent task ID for subtask"),
        labels: z.array(z.string()).optional().describe("Label names"),
        priority: z.number().int().min(1).max(4).optional().describe("Priority: 1=normal, 2=medium, 3=high, 4=urgent"),
        due_string: z.string().optional().describe('Natural language due date e.g. "tomorrow"'),
        due_date: z.string().optional().describe("Due date YYYY-MM-DD"),
        due_datetime: z.string().optional().describe("Due datetime RFC3339"),
        assignee_id: z.string().optional().describe("Assignee user ID"),
        duration: z.number().int().positive().optional().describe("Duration amount"),
        duration_unit: z.enum(["minute", "day"]).optional().describe("Duration unit"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) => {
      try {
        const body: Record<string, unknown> = { content: params.content };
        if (params.description !== undefined) body.description = params.description;
        if (params.project_id !== undefined) body.project_id = params.project_id;
        if (params.section_id !== undefined) body.section_id = params.section_id;
        if (params.parent_id !== undefined) body.parent_id = params.parent_id;
        if (params.labels !== undefined) body.labels = params.labels;
        if (params.priority !== undefined) body.priority = params.priority;
        if (params.due_string !== undefined) body.due_string = params.due_string;
        if (params.due_date !== undefined) body.due_date = params.due_date;
        if (params.due_datetime !== undefined) body.due_datetime = params.due_datetime;
        if (params.assignee_id !== undefined) body.assignee_id = params.assignee_id;
        if (params.duration !== undefined) body.duration = params.duration;
        if (params.duration_unit !== undefined) body.duration_unit = params.duration_unit;

        const task = await apiRequest<Task>("tasks", "POST", body);
        return {
          content: [{ type: "text", text: `Task created successfully!\n\n${formatTask(task)}` }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Update task
  server.registerTool(
    "todoist_update_task",
    {
      title: "Update Todoist Task",
      description: `Update an existing Todoist task. Only provided fields are updated.

Args:
  - task_id (string, required): Task ID to update
  - content (string, optional): New task title
  - description (string, optional): New description
  - labels (array[string], optional): Replace all labels
  - priority (integer, optional): 1=normal, 2=medium, 3=high, 4=urgent
  - due_string (string, optional): New due date as natural language
  - due_date (string, optional): New due date YYYY-MM-DD
  - due_datetime (string, optional): New due datetime RFC3339
  - assignee_id (string, optional): New assignee user ID
  - duration (integer, optional): Duration amount
  - duration_unit (string, optional): "minute" or "day"

Returns: Updated task object.`,
      inputSchema: z.object({
        task_id: z.string().describe("Task ID to update"),
        content: z.string().optional().describe("New task title"),
        description: z.string().optional().describe("New description"),
        labels: z.array(z.string()).optional().describe("Replace all labels"),
        priority: z.number().int().min(1).max(4).optional().describe("Priority: 1=normal, 2=medium, 3=high, 4=urgent"),
        due_string: z.string().optional().describe("New due date as natural language"),
        due_date: z.string().optional().describe("New due date YYYY-MM-DD"),
        due_datetime: z.string().optional().describe("New due datetime RFC3339"),
        assignee_id: z.string().optional().describe("New assignee user ID"),
        duration: z.number().int().positive().optional().describe("Duration amount"),
        duration_unit: z.enum(["minute", "day"]).optional().describe("Duration unit"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) => {
      try {
        const { task_id, ...fields } = params;
        const body: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(fields)) {
          if (value !== undefined) body[key] = value;
        }

        const task = await apiRequest<Task>(`tasks/${task_id}`, "POST", body);
        return {
          content: [{ type: "text", text: `Task updated successfully!\n\n${formatTask(task)}` }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Close task
  server.registerTool(
    "todoist_close_task",
    {
      title: "Close (Complete) Todoist Task",
      description: `Mark a Todoist task as completed.

Args:
  - task_id (string, required): Task ID to close/complete

Returns: Confirmation message.`,
      inputSchema: z.object({
        task_id: z.string().describe("Task ID to complete"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        await apiRequest(`tasks/${params.task_id}/close`, "POST");
        return { content: [{ type: "text", text: `Task ${params.task_id} marked as completed.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Reopen task
  server.registerTool(
    "todoist_reopen_task",
    {
      title: "Reopen Todoist Task",
      description: `Reopen a previously completed Todoist task.

Args:
  - task_id (string, required): Task ID to reopen

Returns: Confirmation message.`,
      inputSchema: z.object({
        task_id: z.string().describe("Task ID to reopen"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        await apiRequest(`tasks/${params.task_id}/reopen`, "POST");
        return { content: [{ type: "text", text: `Task ${params.task_id} reopened.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Move task
  server.registerTool(
    "todoist_move_task",
    {
      title: "Move Todoist Task",
      description: `Move a task to a different project, section, or make it a subtask.

Args:
  - task_id (string, required): Task ID to move
  - project_id (string, optional): Move to this project
  - section_id (string, optional): Move to this section
  - parent_id (string, optional): Make subtask of this task

Returns: Confirmation message.`,
      inputSchema: z.object({
        task_id: z.string().describe("Task ID to move"),
        project_id: z.string().optional().describe("Target project ID"),
        section_id: z.string().optional().describe("Target section ID"),
        parent_id: z.string().optional().describe("Target parent task ID"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) => {
      try {
        const { task_id, ...fields } = params;
        const body: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(fields)) {
          if (value !== undefined) body[key] = value;
        }

        await apiRequest(`tasks/${task_id}/move`, "POST", body);
        return { content: [{ type: "text", text: `Task ${task_id} moved successfully.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // Delete task
  server.registerTool(
    "todoist_delete_task",
    {
      title: "Delete Todoist Task",
      description: `Permanently delete a Todoist task. This action cannot be undone.

Args:
  - task_id (string, required): Task ID to delete

Returns: Confirmation message.`,
      inputSchema: z.object({
        task_id: z.string().describe("Task ID to delete"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (params) => {
      try {
        await apiRequest(`tasks/${params.task_id}`, "DELETE");
        return { content: [{ type: "text", text: `Task ${params.task_id} deleted.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
