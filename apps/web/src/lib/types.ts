export interface User {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  city: string | null;
  profile_completed_at: string | null;
  religion: "muslim" | "christian" | "non-religious" | "unspecified";
  email_verified: boolean;
  timezone: string;
  language: string;
  theme: "system" | "light" | "dark";
  calendar_mode: "gregorian" | "ethiopian" | "dual";
  numeral_mode: "western" | "geez" | "both";
  quiet_hours_start: string;
  quiet_hours_end: string;
  ai_access: Record<string, boolean>;
  notification_channels: Record<string, boolean>;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface SessionInfo {
  id: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface TimelineItem {
  id: string;
  entity_type: string;
  entity_id: string | null;
  title: string;
  description: string | null;
  occurred_at: string;
  pinned: boolean;
  archived: boolean;
  group_key: string | null;
  meta: Record<string, unknown>;
}

export interface TimelinePage {
  items: TimelineItem[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface MessageResponse {
  message: string;
}

export interface Reminder {
  id: string;
  type: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  timezone: string;
  recurrence_rule: string | null;
  status: "scheduled" | "completed" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  snoozed_until: string | null;
  quiet_hours_ok: boolean;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
}

// ── AI Settings & Memory Types ──

export interface AISettings {
  ai_perspective: string;
  ai_local_enabled: boolean;
  ai_local_model: string | null;
  ai_cloud_model: string | null;
  ai_memory_enabled: boolean;
  ai_journal_context: boolean;
  ai_save_new_memories: boolean;
}

export interface AIMemory {
  id: string;
  content: string;
  category: string;
  source: string;
  importance: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ProviderStatus {
  active_provider: string;
  model: string;
  ollama_configured: boolean;
  ollama_available: boolean;
  openai_configured: boolean;
  anthropic_configured: boolean;
  gemini_configured: boolean;
  nvidia_configured: boolean;
  local_ollama_available: boolean;
  local_models: string[];
}

export interface ModelCatalogItem {
  internal_id: string;
  friendly_name: string;
  description: string;
  badge: string;
  ram_mb: number;
  category: string;
  size?: string;
  installed?: boolean;
  available?: boolean;
}

export interface HardwareInfo {
  os: string;
  architecture: string;
  cpu_count: number;
  ram_total_mb: number;
  ram_available_mb: number;
  disk_available_gb: number;
  ollama_installed: boolean;
  ollama_version: string | null;
  ollama_running: boolean;
  installed_models: string[];
  gpu_available: boolean;
  gpu_name: string | null;
  gpu_vram_mb: number;
}

export interface ModelRecommendation {
  model_id: string;
  friendly_name: string;
  description: string;
  badge: string;
  ram_mb: number;
  reason: string;
  hardware_ready: boolean;
}

export interface HardwareCheckResult {
  hardware: HardwareInfo;
  recommendation: ModelRecommendation;
}

export interface CatalogResult {
  local_models: ModelCatalogItem[];
  cloud_models: ModelCatalogItem[];
  ollama_running: boolean;
  ollama_installed: boolean;
}
