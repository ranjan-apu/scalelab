/* Design entities (mirror D1 `designs` table). */

export interface DesignRow {
  id: string;
  user_id: string;
  name: string;
  /** Raw JSON string of the topology (nodes/edges/annotations). */
  data: string;
  created_at: number;
  updated_at: number;
}

export interface DesignSummaryRow {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  size: number;
}

export interface DesignDetail {
  id: string;
  name: string;
  /** Parsed topology payload. */
  data: unknown;
  created_at: number;
  updated_at: number;
}
