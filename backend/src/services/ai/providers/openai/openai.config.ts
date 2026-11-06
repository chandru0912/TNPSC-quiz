/**
 * OpenAI configuration management.
 * Supports API key resolution, model aliasing, and .env persistence.
 */

import fs from 'fs';
import path from 'path';

export const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';

export function resolveOpenAIModel(rawModel?: string): string {
  const model = String(rawModel || '').trim();
  if (!model) return OPENAI_DEFAULT_MODEL;

  const normalized = model.toLowerCase();
  if (normalized === 'gpt-4o' || normalized === 'gpt-4o-2024-08-06') return 'gpt-4o';
  if (normalized === 'gpt-4o-mini' || normalized === 'gpt-4o-mini-2024-07-18') return 'gpt-4o-mini';
  if (normalized === 'gpt-4.1' || normalized === 'gpt-4.1-2025-04-14') return 'gpt-4.1';
  if (normalized === 'gpt-4.1-mini' || normalized === 'gpt-4.1-mini-2025-04-14') return 'gpt-4.1-mini';
  if (normalized === 'gpt-4-turbo' || normalized === 'gpt-4-turbo-2024-04-09') return 'gpt-4-turbo';
  if (normalized === 'gpt-4' || normalized === 'gpt-4-0613') return 'gpt-4';
  if (normalized === 'gpt-4.5-preview' || normalized === 'gpt-4.5') return 'gpt-4.5-preview';

  return model;
}

export function getOpenAiApiKey(): string {
  return (process.env.OPENAI_API_KEY || '').trim();
}

export function getOpenAiModel(): string {
  return resolveOpenAIModel(process.env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL);
}

export function maskOpenAiApiKey(key?: string): string {
  const raw = key || getOpenAiApiKey();
  if (!raw) return '';
  if (raw.length <= 10) return '••••••••';
  const prefix = raw.slice(0, 7);
  const suffix = raw.slice(-4);
  return `${prefix}••••••••••••${suffix}`;
}

export function persistOpenAiEnv(apiKey?: string, model?: string): void {
  const envPaths = [
    path.resolve(process.cwd(), 'backend', '.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../../../.env'),
    path.resolve(__dirname, '../../../../../backend/.env'),
  ];

  for (const p of envPaths) {
    if (!fs.existsSync(p)) continue;

    try {
      let content = fs.readFileSync(p, 'utf8');
      if (apiKey !== undefined && apiKey.trim()) {
        const cleanKey = apiKey.trim();
        if (/^OPENAI_API_KEY=.*/m.test(content)) {
          content = content.replace(/^OPENAI_API_KEY=.*$/m, `OPENAI_API_KEY=${cleanKey}`);
        } else {
          content += `\nOPENAI_API_KEY=${cleanKey}\n`;
        }
      }

      if (model !== undefined && model.trim()) {
        const cleanModel = model.trim();
        if (/^OPENAI_MODEL=.*/m.test(content)) {
          content = content.replace(/^OPENAI_MODEL=.*$/m, `OPENAI_MODEL=${cleanModel}`);
        } else {
          content += `\nOPENAI_MODEL=${cleanModel}\n`;
        }
      }

      fs.writeFileSync(p, content, 'utf8');
    } catch (e) {
      console.warn('[OpenAIConfig] Could not update env file:', e);
    }
  }
}
