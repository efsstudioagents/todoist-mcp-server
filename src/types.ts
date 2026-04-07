export interface TaskDue {
  date: string;
  is_recurring: boolean;
  datetime?: string;
  string: string;
  timezone?: string;
}

export interface TaskDuration {
  amount: number;
  unit: "minute" | "day";
}

export interface Task {
  id: string;
  content: string;
  description: string;
  project_id: string;
  section_id: string | null;
  parent_id: string | null;
  order: number;
  labels: string[];
  priority: number;
  due: TaskDue | null;
  url: string;
  comment_count: number;
  assignee_id: string | null;
  assigner_id: string | null;
  creator_id: string;
  created_at: string;
  is_completed: boolean;
  duration: TaskDuration | null;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  parent_id: string | null;
  order: number;
  comment_count: number;
  is_shared: boolean;
  is_favorite: boolean;
  is_inbox_project: boolean;
  is_team_inbox: boolean;
  view_style: string;
  url: string;
}

export interface Section {
  id: string;
  project_id: string;
  order: number;
  name: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  order: number;
  is_favorite: boolean;
}

export interface Comment {
  id: string;
  task_id?: string;
  project_id?: string;
  posted_at: string;
  content: string;
  attachment?: CommentAttachment;
}

export interface CommentAttachment {
  file_name: string;
  file_type: string;
  file_url: string;
  resource_type: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  has_more: boolean;
  next_cursor?: string;
}
