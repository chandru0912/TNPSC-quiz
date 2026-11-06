/**
 * AI Provider Factory
 * TNPSC Study Hub - Multi-Provider Isolation Architecture
 *
 * Enforces strict provider separation:
 * - Direct lookup of provider instances.
 * - ABSOLUTELY ZERO cross-provider automatic fallback.
 * - Independent configuration and status tracking.
 */

import { IAIProvider, AIProviderName, AIProviderConfigInfo } from './ai-provider.interface';
import { ClaudeService } from './providers/claude/claude.service';
import { GeminiService } from './providers/gemini/gemini.service';
import { OpenAIService } from './providers/openai/openai.service';
import pool from '../../db';

export class AIProviderFactory {
  /**
   * Retrieves a specific provider by name.
   * Throws an error if unknown provider name is supplied.
   */
  static getProvider(name: AIProviderName | string): IAIProvider {
    const cleanName = String(name || '').trim().toLowerCase();
    if (cleanName === 'gemini' || cleanName === 'google' || cleanName === 'google_gemini') {
      return GeminiService;
    }
    if (cleanName === 'claude' || cleanName === 'anthropic') {
      return ClaudeService;
    }
    if (cleanName === 'openai' || cleanName === 'oai' || cleanName === 'open_ai') {
      return OpenAIService;
    }
    throw new Error(`Unsupported AI Provider "${name}". Supported providers are 'claude', 'gemini', and 'openai'.`);
  }

  /**
   * Returns the system-wide active AI provider configured in PostgreSQL.
   * Defaults to 'claude' if no active provider is set.
   */
  static async getActiveProvider(): Promise<IAIProvider> {
    try {
      const res = await pool.query(
        "SELECT provider FROM ai_provider_configs WHERE is_active = true LIMIT 1"
      );
      if (res.rows.length > 0 && res.rows[0].provider) {
        return this.getProvider(res.rows[0].provider);
      }
    } catch {
      // Fall back to Claude if database config is not yet initialized
    }
    return ClaudeService;
  }

  /**
   * Returns the name of the system active provider ('claude' | 'gemini' | 'openai').
   */
  static async getActiveProviderName(): Promise<AIProviderName> {
    const prov = await this.getActiveProvider();
    return prov.name;
  }

  /**
   * Switches the active provider in the database.
   */
  static async setActiveProvider(providerName: AIProviderName): Promise<void> {
    const cleanName = providerName === 'gemini' ? 'gemini' : providerName === 'openai' ? 'openai' : 'claude';
    await pool.query('BEGIN');
    try {
      await pool.query('UPDATE ai_provider_configs SET is_active = false');
      await pool.query(
        `INSERT INTO ai_provider_configs (provider, model, is_active, updated_at)
         VALUES ($1, $2, true, CURRENT_TIMESTAMP)
         ON CONFLICT (provider) DO UPDATE SET is_active = true, updated_at = CURRENT_TIMESTAMP`,
        [
          cleanName,
          cleanName === 'gemini'
            ? 'gemini-3.8-flash'
            : cleanName === 'openai'
            ? 'gpt-4o-mini'
            : 'claude-3-5-sonnet-20241022',
        ]
      );
      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }
  }

  /**
   * Returns status for all supported providers.
   */
  static async getAllStatuses(): Promise<AIProviderConfigInfo[]> {
    const [claudeStatus, geminiStatus, openaiStatus] = await Promise.all([
      ClaudeService.getStatus(),
      GeminiService.getStatus(),
      OpenAIService.getStatus(),
    ]);

    return [claudeStatus, geminiStatus, openaiStatus];
  }
}
