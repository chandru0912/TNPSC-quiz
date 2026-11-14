/**
 * Google Gemini Configuration Management
 * Handles API key resolution, model aliases, and secure local environment persistence.
 */

import fs from 'fs';
import path from 'path';

export const GEMINI_DEFAULT_MODEL = 'gemini-3.5-flash';

/**
 * Normalizes model aliases to valid, currently active Gemini model identifiers.
 * Automatically maps deprecated models (1.5-flash, 2.0-flash, 2.5-flash) to the verified gemini-3.5-flash.
 */
export function resolveGeminiModel(rawModel?: string): string {
  const model = String(rawModel || '').trim().toLowerCase();
  if (!model) return GEMINI_DEFAULT_MODEL;

  // Active verified models
  if (model === 'gemini-3.5' || model === 'gemini-3.5-flash') {
    return 'gemini-3.5-flash';
  }
  if (model === 'gemini-3.5-flash-lite' || model === 'flash-lite') {
    return 'gemini-3.5-flash-lite';
  }
  if (model === 'gemini-3.1-flash-lite') {
    return 'gemini-3.1-flash-lite';
  }
  if (model === 'gemini-3.6' || model === 'gemini-3.6-flash') {
    return 'gemini-3.6-flash';
  }
  if (model === 'gemini-flash-lite-latest') {
    return 'gemini-flash-lite-latest';
  }
  if (model === 'gemini-3.8' || model === 'gemini-3.8-flash') {
    return 'gemini-3.8-flash';
  }

  // Deprecated models - auto-map to active gemini-3.5-flash
  if (
    model === 'gemini-flash' ||
    model === 'gemini-1.5-flash' ||
    model === 'flash' ||
    model === 'gemini-pro' ||
    model === 'gemini-1.5-pro' ||
    model === 'pro' ||
    model === 'gemini-2.0-flash' ||
    model === 'gemini-2-flash' ||
    model === 'gemini-2.0' ||
    model === 'gemini-2.5-flash' ||
    model === 'gemini-2.5-flash-lite'
  ) {
    return 'gemini-3.5-flash';
  }

  // If starts with "models/", strip it for SDK compatibility or keep base name
  return rawModel!.replace(/^models\//i, '').trim();
}

export function getGeminiApiKey(): string {
  return (process.env.GEMINI_API_KEY || '').trim();
}

export function getGeminiModel(): string {
  return resolveGeminiModel(process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL);
}

export const GEMINI_DEFAULT_FALLBACK_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.6-flash',
];

export function getGeminiFallbackModels(): string[] {
  const envVal = process.env.GEMINI_FALLBACK_MODELS;
  if (envVal) {
    const list = envVal
      .split(',')
      .map((m) => resolveGeminiModel(m.trim()))
      .filter(Boolean);
    if (list.length > 0) return list;
  }
  return GEMINI_DEFAULT_FALLBACK_MODELS;
}

export function maskGeminiApiKey(key?: string): string {
  const raw = key || getGeminiApiKey();
  if (!raw) return '';
  if (raw.length <= 10) return '••••••••';
  const prefix = raw.slice(0, 6);
  const suffix = raw.slice(-4);
  return `${prefix}••••••••••••${suffix}`;
}

/**
 * Persists Gemini credentials to backend .env file safely without disturbing other variables.
 */
export function persistGeminiEnv(apiKey?: string, model?: string): void {
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
          if (/^GEMINI_API_KEY=.*/m.test(content)) {
            content = content.replace(/^GEMINI_API_KEY=.*$/m, `GEMINI_API_KEY=${cleanKey}`);
          } else {
            content += `\nGEMINI_API_KEY=${cleanKey}\n`;
          }
        }
        if (model !== undefined && model.trim()) {
          const cleanModel = model.trim();
          if (/^GEMINI_MODEL=.*/m.test(content)) {
            content = content.replace(/^GEMINI_MODEL=.*$/m, `GEMINI_MODEL=${cleanModel}`);
          } else {
            content += `\nGEMINI_MODEL=${cleanModel}\n`;
          }
        }
        fs.writeFileSync(p, content, 'utf8');
      } catch (e) {
        console.warn(`[GeminiConfig] Could not update ${p}:`, e);
      }
    }
  }
}

