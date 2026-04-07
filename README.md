# todoist-mcp-server

MCP server for the [Todoist REST API](https://developer.todoist.com/rest/v2/), built with TypeScript and the [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk).

## Tools

**Tasks** — `todoist_list_tasks`, `todoist_get_task`, `todoist_create_task`, `todoist_update_task`, `todoist_close_task`, `todoist_reopen_task`, `todoist_move_task`, `todoist_delete_task`

**Projects** — `todoist_list_projects`, `todoist_get_project`, `todoist_create_project`, `todoist_update_project`, `todoist_delete_project`

**Sections** — `todoist_list_sections`, `todoist_get_section`, `todoist_create_section`, `todoist_update_section`, `todoist_delete_section`

**Labels** — `todoist_list_labels`, `todoist_get_label`, `todoist_create_label`, `todoist_update_label`, `todoist_delete_label`

**Comments** — `todoist_list_comments`, `todoist_get_comment`, `todoist_create_comment`, `todoist_update_comment`, `todoist_delete_comment`

## Setup

### 1. Get your Todoist API token

Go to **Todoist → Settings → Integrations → Developer → API token**.

### 2. Install and build

```bash
npm install
npm run build
```

### 3. Configure Claude Code

Add to `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "todoist": {
      "command": "node",
      "args": ["/path/to/todoist-mcp-server/dist/index.js"],
      "env": {
        "TODOIST_API_TOKEN": "your_token_here"
      }
    }
  }
}
```

Restart Claude Code — the tools will be available immediately.

## Requirements

- Node.js >= 18
- Todoist account + API token
