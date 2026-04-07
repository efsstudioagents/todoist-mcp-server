import axios, { AxiosError } from "axios";
import { API_BASE_URL } from "./constants.js";

let apiToken: string;

export function initClient(token: string): void {
  apiToken = token;
}

export async function apiRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  data?: Record<string, unknown>,
  params?: Record<string, unknown>
): Promise<T> {
  const response = await axios({
    method,
    url: `${API_BASE_URL}/${endpoint}`,
    data,
    params,
    timeout: 30000,
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
  });
  return response.data as T;
}

export function handleApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<{ error?: string; error_tag?: string }>;
    if (axiosErr.response) {
      const msg = axiosErr.response.data?.error;
      switch (axiosErr.response.status) {
        case 400:
          return `Error: Bad request — ${msg ?? "invalid parameters"}`;
        case 401:
          return "Error: Unauthorized — check your TODOIST_API_TOKEN";
        case 403:
          return "Error: Forbidden — you don't have access to this resource";
        case 404:
          return "Error: Resource not found — check the ID is correct";
        case 429:
          return "Error: Rate limit exceeded — wait before making more requests";
        default:
          return `Error: API request failed (HTTP ${axiosErr.response.status})${msg ? ` — ${msg}` : ""}`;
      }
    } else if (axiosErr.code === "ECONNABORTED") {
      return "Error: Request timed out — please try again";
    }
  }
  return `Error: ${error instanceof Error ? error.message : String(error)}`;
}
