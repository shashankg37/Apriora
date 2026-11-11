export type DepthMode = "summary" | "detailed" | "interview";

export type AgentMode = "essential_notes" | "interview_qa";

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface Job {
  id: string;
  owner_id?: string;
  url: string;
  type: "youtube" | "article" | "transcript";
  title?: string;
  depth: DepthMode;
  status: JobStatus;
  stage: string;
  progress: number;
  error?: string;
  note_id?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Note as presented to the UI: a `notes` row joined with its `sources` row.
 * essential_notes / interview_qa hold markdown text produced by the agents.
 */
export interface Note {
  id: string;
  source_id: string;
  title: string;
  sourceUrl: string;
  sourceType: "youtube" | "article" | "transcript";
  depth: DepthMode;
  markdown: string;
  essential_notes?: string;
  interview_qa?: string;
  model: string;
  flags: string[];
  tags: string[];
  createdAt: string;
}
