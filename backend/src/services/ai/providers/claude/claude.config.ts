/**
 * Anthropic Claude Configuration Management
 * Handles API key resolution, model aliases, and secure local environment persistence.
 */

import fs from 'fs';
import path from 'path';

export const CLAUDE_DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';

/**
 * Resolves user/catalog model aliases to verified Anthropic Messages API model identifiers.
 */
export function resolveClaudeModel(rawModel?: string): string {
  const model = String(rawModel || '').trim().toLowerCase();
  if (!model) return CLAUDE_DEFAULT_MODEL;

  if (
    model === 'claude-sonnet-5-5' ||
    model === 'claude-3-5-sonnet' ||
    model === 'claude-3.5-sonnet'
  ) {
    return 'claude-3-5-sonnet-20241022';
  }
  if (
    model === 'claude-3-7-sonnet' ||
    model === 'claude-3.7-sonnet' ||
    model === 'claude-sonnet-7'
  ) {
    return 'claude-3-7-sonnet-20250219';
  }
  if (
    model === 'claude-3-5-haiku' ||
    model === 'claude-3.5-haiku' ||
    model === 'claude-haiku-5-5'
  ) {
    return 'claude-3-5-haiku-20241022';
  }
  if (model === 'claude-3-opus' || model === 'claude-opus') {
    return 'claude-3-opus-20240229';
  }
  if (model === 'claude-3-haiku' || model === 'claude-haiku') {
    return 'claude-3-haiku-20240307';
  }

  return rawModel!.trim();
}

export function getClaudeApiKey(): string {
  return (process.env.ANTHROPIC_API_KEY || '').trim();
}

export function getClaudeModel(): string {
  return resolveClaudeModel(process.env.CLAUDE_MODEL || process.env.ANTHROPIC_MODEL || CLAUDE_DEFAULT_MODEL);
}

export function maskClaudeApiKey(key?: string): string {
  const raw = key || getClaudeApiKey();
  if (!raw) return '';
  if (raw.length <= 10) return '••••••••';
  const prefix = raw.slice(0, 7);
  const suffix = raw.slice(-4);
  return `${prefix}••••••••••••${suffix}`;
}

/**
 * Persists Claude credentials to backend .env file safely without disturbing other variables.
 */
export function persistClaudeEnv(apiKey?: string, model?: string): void {
  const envPaths = [
    path.resolve(process.cwd(), 'backend', '.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../../../.env'),
    path.resolve(__dirname, '../../../../../backend/.env'),
  ];

  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      try {
        let content = fs.readFileSync(p, 'utf8');
        if (apiKey !== undefined && apiKey.trim()) {
          const cleanKey = apiKey.trim();
          if (/^ANTHROPIC_API_KEY=.*/m.test(content)) {
            content = content.replace(/^ANTHROPIC_API_KEY=.*$/m, `ANTHROPIC_API_KEY=${cleanKey}`);
          } else {
            content += `\nANTHROPIC_API_KEY=${cleanKey}\n`;
          }
        }
        if (model !== undefined && model.trim()) {
          const cleanModel = model.trim();
          if (/^CLAUDE_MODEL=.*/m.test(content)) {
            content = content.replace(/^CLAUDE_MODEL=.*$/m, `CLAUDE_MODEL=${cleanModel}`);
          } else {
            content += `\nCLAUDE_MODEL=${cleanModel}\n`;
          }
        }
        fs.writeFileSync(p, content, 'utf8');
      } catch (e) {
        console.warn(`[ClaudeConfig] Could not update ${p}:`, e);
      }
    }
  }
}

