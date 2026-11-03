/** Locked against .doc/02_API_联调契约.md v0.1. No provider fields cross this boundary. */
export interface RoleCard { id: string; name: string; tagline: string; description: string; avatar: string }
export interface Topic { id: string; title: string; prompt: string }
export interface DebateRequest { topic: string; roleIds: string[] }
export interface DebateMessage { id: string; round: 1 | 2; roleId: string; content: string; replyTo: string | null }
export interface DebateSummary { consensus: string[]; disagreements: string[]; decisionFactors: string[]; nextActions: string[] }
export interface DebateUsage { inputTokens: number; outputTokens: number }
export interface DebateResponse { discussionId: string; topic: string; messages: DebateMessage[]; summary: DebateSummary; usage: DebateUsage | null }
export interface RolesResponse { roles: RoleCard[] }
export interface TopicsResponse { topics: Topic[] }
export type ApiErrorCode = 'INVALID_INPUT' | 'RATE_LIMITED' | 'INVALID_MODEL_OUTPUT' | 'MODEL_TIMEOUT' | 'INTERNAL_ERROR';
export interface ApiErrorResponse { error: { code: ApiErrorCode; message: string } }
