// Generated from llm-orchestrator.proto
// Interfaces phải khớp với proto definition

export interface LlmChatRequest {
  message: string;
  tenant_id: string;
  role: string;
  lang: string;
}

export interface LlmChatResponse {
  proposal_text: string;
  changeset: Changeset;
  metadata: Metadata;
}

export interface Changeset {
  model: string;
  features: Feature[];
  impacted_services: string[];
}

export interface Feature {
  key: string;
  value: string;
}

export interface Metadata {
  intent: string;
  confidence: number;
  risk: string;
}

// gRPC Service Interface
export interface LlmOrchestratorService {
  chatOnce(request: LlmChatRequest): Promise<LlmChatResponse>;
}