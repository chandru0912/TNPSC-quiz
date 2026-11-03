/**
 * AI Generation History & Audit Logging Service
 * Records provider, model, tokens, status, and generated item counts independently.
 */

import pool from '../../db';
import { AIProviderName } from './ai-provider.interface';

export interface LogGenerationParams {
  provider: AIProviderName;
  model: string;
  generationType: 'notes' | 'mcq' | 'both';
  groupId?: string;
  standard?: number;
  subject?: string;
  unitId?: number;
  lessonTitle?: string;
  language?: string;
  status: 'success' | 'failed' | 'partial';
  errorMessage?: string;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  itemsCount?: number;
  metadata?: any;
}

export interface AIGenerationLogEntry {
  id: number;
  provider: AIProviderName;
  model: string;
  generationType: string;
  groupId: string;
  standard: number;
  subject: string;
  unitId: number;
  lessonTitle: string;
  language: string;
  status: string;
  errorMessage: string | null;
  tokenUsage: any;
  itemsCount: number;
  createdAt: string;
}

export class AILogsService {
  /**
   * Records a generation event into PostgreSQL.
   */
  static async logGeneration(params: LogGenerationParams): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO ai_generation_logs (
          provider, model, generation_type, group_id, standard, subject,
          unit_id, lesson_title, language, status, error_message,
          token_usage, items_count, metadata, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14::jsonb, CURRENT_TIMESTAMP
        )`,
        [
          params.provider,
          params.model,
          params.generationType,
          params.groupId || null,
          params.standard || null,
          params.subject || null,
          params.unitId || null,
          params.lessonTitle || null,
          params.language || null,
          params.status,
          params.errorMessage || null,
          params.tokenUsage ? JSON.stringify(params.tokenUsage) : null,
          params.itemsCount || 0,
          params.metadata ? JSON.stringify(params.metadata) : null,
        ]
      );
    } catch (e) {
      console.warn('[AILogsService] Non-fatal log persistence note:', e);
    }
  }

  /**
   * Retrieves generation logs, optionally filtered by provider.
   */
  static async getLogs(provider?: string, limit: number = 50): Promise<AIGenerationLogEntry[]> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (provider && provider !== 'all') {
      conditions.push('provider = $1');
      values.push(provider.toLowerCase());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(Math.min(limit, 200));

    const res = await pool.query(
      `SELECT
        id,
        provider,
        model,
        generation_type as "generationType",
        group_id as "groupId",
        standard,
        subject,
        unit_id as "unitId",
        lesson_title as "lessonTitle",
        language,
        status,
        error_message as "errorMessage",
        token_usage as "tokenUsage",
        items_count as "itemsCount",
        created_at as "createdAt"
       FROM ai_generation_logs
       ${whereClause}
       ORDER BY id DESC
       LIMIT $${values.length}`,
      values
    );

    return res.rows;
  }
}

