/**
 * AI Provider Prompt Management Service
 * Supports versioning, editing, restoring, and isolated per-provider storage in PostgreSQL.
 */

import pool from '../../db';
import { AIProviderName, AIPromptType, AIPromptRecord } from './ai-provider.interface';
import { CLAUDE_DEFAULT_PROMPTS } from './providers/claude/claude.prompts';
import { GEMINI_DEFAULT_PROMPTS } from './providers/gemini/gemini.prompts';

export class AIPromptsService {
  /**
   * Initializes default prompts in the database if empty.
   */
  static async seedDefaultsIfEmpty(): Promise<void> {
    const providers: AIProviderName[] = ['claude', 'gemini'];
    const types: AIPromptType[] = ['notes_system', 'notes_template', 'mcq_system', 'mcq_template'];

    for (const provider of providers) {
      const defMap = provider === 'claude' ? CLAUDE_DEFAULT_PROMPTS : GEMINI_DEFAULT_PROMPTS;
      for (const type of types) {
        const def = (defMap as any)[type];
        if (!def) continue;

        try {
          const res = await pool.query(
            'SELECT id FROM ai_provider_prompts WHERE provider = $1 AND prompt_type = $2 LIMIT 1',
            [provider, type]
          );
          if (res.rows.length === 0) {
            await pool.query(
              `INSERT INTO ai_provider_prompts (provider, prompt_type, title, content, version, is_current)
               VALUES ($1, $2, $3, $4, 1, true)`,
              [provider, type, def.title, def.content]
            );
          }
        } catch (e) {
          console.warn(`[AIPrompts] Could not seed default prompt for ${provider}/${type}:`, e);
        }
      }
    }
  }

  /**
   * Retrieves active current prompts for a provider.
   */
  static async getCurrentPrompts(provider: AIProviderName): Promise<AIPromptRecord[]> {
    await this.seedDefaultsIfEmpty();

    const res = await pool.query(
      `SELECT id, provider, prompt_type as "promptType", title, content, version, is_current as "isCurrent",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM ai_provider_prompts
       WHERE provider = $1 AND is_current = true
       ORDER BY prompt_type ASC`,
      [provider]
    );

    return res.rows;
  }

  /**
   * Retrieves specific prompt template content.
   */
  static async getPromptContent(provider: AIProviderName, promptType: AIPromptType): Promise<string> {
    try {
      const res = await pool.query(
        `SELECT content FROM ai_provider_prompts
         WHERE provider = $1 AND prompt_type = $2 AND is_current = true
         LIMIT 1`,
        [provider, promptType]
      );
      if (res.rows.length > 0 && res.rows[0].content) {
        return res.rows[0].content;
      }
    } catch {
      // Fallback to static defaults
    }

    const defMap = provider === 'claude' ? CLAUDE_DEFAULT_PROMPTS : GEMINI_DEFAULT_PROMPTS;
    return (defMap as any)[promptType]?.content || '';
  }

  /**
   * Saves a new version of a prompt, preserving prior version history.
   */
  static async savePrompt(
    provider: AIProviderName,
    promptType: AIPromptType,
    title: string,
    content: string
  ): Promise<AIPromptRecord> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get latest version
      const verRes = await client.query(
        `SELECT COALESCE(MAX(version), 0) as max_ver FROM ai_provider_prompts
         WHERE provider = $1 AND prompt_type = $2`,
        [provider, promptType]
      );
      const nextVer = Number(verRes.rows[0].max_ver) + 1;

      // Set existing to not current
      await client.query(
        `UPDATE ai_provider_prompts SET is_current = false, updated_at = CURRENT_TIMESTAMP
         WHERE provider = $1 AND prompt_type = $2`,
        [provider, promptType]
      );

      // Insert new version
      const insRes = await client.query(
        `INSERT INTO ai_provider_prompts (provider, prompt_type, title, content, version, is_current)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING id, provider, prompt_type as "promptType", title, content, version, is_current as "isCurrent",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [provider, promptType, title.trim() || promptType, content.trim(), nextVer]
      );

      await client.query('COMMIT');
      return insRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Gets version history for a given prompt type.
   */
  static async getVersionHistory(
    provider: AIProviderName,
    promptType: AIPromptType
  ): Promise<AIPromptRecord[]> {
    const res = await pool.query(
      `SELECT id, provider, prompt_type as "promptType", title, content, version, is_current as "isCurrent",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM ai_provider_prompts
       WHERE provider = $1 AND prompt_type = $2
       ORDER BY version DESC`,
      [provider, promptType]
    );
    return res.rows;
  }

  /**
   * Restores an earlier version of a prompt.
   */
  static async restoreVersion(
    provider: AIProviderName,
    promptType: AIPromptType,
    versionNumber: number
  ): Promise<AIPromptRecord> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const target = await client.query(
        `SELECT id, title, content FROM ai_provider_prompts
         WHERE provider = $1 AND prompt_type = $2 AND version = $3`,
        [provider, promptType, versionNumber]
      );

      if (target.rows.length === 0) {
        throw new Error(`Version ${versionNumber} for ${provider}/${promptType} not found.`);
      }

      // Mark all not current
      await client.query(
        `UPDATE ai_provider_prompts SET is_current = false
         WHERE provider = $1 AND prompt_type = $2`,
        [provider, promptType]
      );

      // Mark target version current
      const updRes = await client.query(
        `UPDATE ai_provider_prompts SET is_current = true, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, provider, prompt_type as "promptType", title, content, version, is_current as "isCurrent",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [target.rows[0].id]
      );

      await client.query('COMMIT');
      return updRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

