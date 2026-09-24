/**
 * SkillOrbit — API Service
 * Centralized API client for all backend communication.
 */

const API_BASE = '/api';

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    credentials: 'include', // Include session cookie
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new ApiError(response.status, errorData.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// ── Session & Profile ──

export async function onboard(data: {
  language: string;
  path: string;
  display_name?: string;
  daily_goal_minutes: number;
  timezone?: string;
}) {
  return request('/onboard', { method: 'POST', body: data });
}

export async function getProfile() {
  return request<{
    id: string;
    display_name: string;
    language: string;
    active_path: string;
    daily_goal_minutes: number;
    timezone: string;
    created_at: string;
    stats: {
      total_xp: number;
      lessons_completed: number;
      total_attempts: number;
      active_days: number;
      due_reviews: number;
      due_review_lessons: string[];
      evidence_note: string;
    };
  }>('/profile');
}

export async function updateProfile(data: {
  language?: string;
  path?: string;
  display_name?: string;
  daily_goal_minutes?: number;
}) {
  return request('/profile', { method: 'PATCH', body: data });
}

// ── Curriculum ──

export interface LessonSummary {
  id: string;
  type: string;
  audience: string;
  version: string;
  title: string;
  description: string;
  outcome: string;
  estimated_duration_minutes: number;
  prerequisites: string[];
  prerequisites_met: boolean;
  is_locked: boolean;
  progress: {
    completed: boolean;
    total_xp: number;
    attempt_count: number;
    task_passed: boolean;
  };
  translation_status: { reviewed: boolean };
}

export async function getCurriculum() {
  return request<{ language: string; path: string; lessons: LessonSummary[] }>('/curriculum');
}

// ── Lessons ──

export interface LessonContent {
  title: string;
  description: string;
  outcome: string;
  explanation: string;
  worked_example: {
    scenario: string;
    bad_attempt: string;
    good_attempt: string;
    why_better: string;
  };
  interactive_task: {
    instruction: string;
    starter_text: string;
    hints: string[];
    sample_good_response: string;
    evaluation_criteria: string[];
    produces_artifact: boolean;
    artifact_type?: string;
  };
  understanding_checks: Array<{
    question: string;
    options: string[];
    correct_index: number;
    explanation: string;
  }>;
  feedback_templates: { pass: string; partial: string; fail: string };
  retry_hint: string;
  recap: string;
  glossary_terms: Array<{ term: string; definition: string }>;
}

export interface LessonDetail {
  id: string;
  version: string;
  type: string;
  audience: string;
  estimated_duration_minutes: number;
  prerequisites: string[];
  content: LessonContent;
  translation_status: { reviewed: boolean };
  progress: {
    completed: boolean;
    total_xp: number;
    attempt_count: number;
    task_passed: boolean;
  };
  attempts: Array<{
    id: string;
    type: string;
    user_input: Record<string, unknown>;
    feedback: { text: string; simulated_response?: string };
    evaluation_mode: string;
    criteria_results: Array<{ criterion: string; met: boolean; reason: string }>;
    xp_awarded: number;
    passed: boolean;
    created_at: string;
    lesson_version: string;
  }>;
}

export async function getLesson(lessonId: string) {
  return request<LessonDetail>(`/lessons/${lessonId}`);
}

// ── Attempts ──

export async function submitTaskAttempt(data: {
  lesson_id: string;
  user_input: string;
  idempotency_key: string;
}) {
  return request<{
    attempt_id: string;
    feedback: { text: string; simulated_response?: string };
    criteria_results: Array<{ criterion: string; met: boolean; reason: string }>;
    evaluation_mode: string;
    xp_awarded: number;
    passed: boolean;
    progress: { completed: boolean; total_xp: number; attempt_count: number };
    idempotent: boolean;
  }>('/attempts/task', { method: 'POST', body: data });
}

export async function submitCheckAttempt(data: {
  lesson_id: string;
  check_index: number;
  selected_index: number;
  idempotency_key: string;
}) {
  return request<{
    attempt_id: string;
    feedback: { text: string };
    passed: boolean;
    xp_awarded: number;
    idempotent: boolean;
  }>('/attempts/check', { method: 'POST', body: data });
}

// ── Progress & History ──

export async function getProgress() {
  return request<{
    progress: Array<{
      lesson_id: string;
      completed: boolean;
      total_xp: number;
      attempt_count: number;
      task_passed: boolean;
      first_completed_at: string | null;
      last_attempt_at: string | null;
      best_criteria_met: number;
    }>;
  }>('/progress');
}

export async function getHistory(lessonId?: string, limit = 20) {
  const params = new URLSearchParams();
  if (lessonId) params.set('lesson_id', lessonId);
  params.set('limit', String(limit));
  return request(`/history?${params}`);
}

// ── Saved Items ──

export async function saveItem(data: {
  lesson_id: string;
  item_type?: string;
  label?: string;
  note?: string;
  highlight_text?: string;
}) {
  return request<{ id: string; message: string }>('/saved', { method: 'POST', body: data });
}

export async function getSavedItems(label?: string, search?: string) {
  const params = new URLSearchParams();
  if (label) params.set('label', label);
  if (search) params.set('search', search);
  return request<{
    items: Array<{
      id: string;
      lesson_id: string;
      item_type: string;
      label: string;
      note: string | null;
      highlight_text: string | null;
      language_at_save: string;
      created_at: string;
    }>;
  }>(`/saved?${params}`);
}

export async function updateSavedItem(itemId: string, data: { label?: string; note?: string }) {
  return request(`/saved/${itemId}`, { method: 'PATCH', body: data });
}

export async function deleteSavedItem(itemId: string) {
  return request(`/saved/${itemId}`, { method: 'DELETE' });
}

// ── Projects ──

export async function saveProject(data: {
  lesson_id: string;
  title: string;
  artifact_type: string;
  artifact_data: Record<string, unknown>;
}) {
  return request<{ id: string }>('/projects', { method: 'POST', body: data });
}

export async function getProjects() {
  return request<{
    projects: Array<{
      id: string;
      lesson_id: string;
      title: string;
      artifact_type: string;
      artifact_data: Record<string, unknown>;
      lesson_version: string;
      language: string;
      created_at: string;
    }>;
  }>('/projects');
}

// ── Reviews ──

export async function getReviews() {
  return request<{
    reviews: Array<{
      lesson_id: string;
      next_review: string;
      interval_days: number;
      success_count: number;
      is_due: boolean;
      difficulty_rating: number | null;
    }>;
  }>('/reviews');
}

export async function completeReview(data: { lesson_id: string; difficulty_rating?: number }) {
  return request('/reviews/complete', { method: 'POST', body: data });
}

// ── Data Export & Deletion ──

export async function exportData() {
  return request('/export');
}

export async function deleteAccount() {
  return request('/account', { method: 'DELETE' });
}

// ── Meta ──

export async function getLanguages() {
  return request<{ languages: Record<string, string> }>('/languages');
}

export async function getPaths() {
  return request<{ paths: Record<string, string> }>('/paths');
}

export async function healthCheck() {
  return request<{ status: string; mode: string; ai_provider: string }>('/health');
}

// ── Helpers ──

export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

export { ApiError };
