import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

const agentBackendSchema = z.object({
  // Local CLI that is already signed in on this host.
  cli: z.enum(["claude", "codex"]).default("claude"),
  // Empty means the CLI default; claude falls back to "haiku".
  model: z.string().default(""),
  // Absolute path override when the binary is not on the daemon PATH.
  command: z.string().default(""),
});

const apiBackendSchema = z.object({
  format: z.enum(["openai", "anthropic"]).default("openai"),
  // Includes the version segment, e.g. https://api.openai.com/v1
  baseUrl: z.string().default(""),
  model: z.string().default(""),
  // The key is read from a file or an environment variable, never stored here.
  apiKeyFile: z.string().default(""),
  apiKeyEnv: z.string().default(""),
  // Merged into the request body, e.g. { "max_tokens": 64 }.
  extraBody: z.record(z.string(), z.json()).default({}),
});

export const settingsSchema = z.object({
  enabled: z.boolean().default(true),
  backend: z.enum(["agent", "api"]).default("agent"),
  language: z.string().default("简体中文"),
  maxChars: z.number().int().min(8).max(80).default(16),
  includeSubagents: z.boolean().default(false),
  timeoutMs: z.number().int().min(5_000).max(300_000).default(90_000),
  paseoCommand: z.string().default("paseo"),
  agent: agentBackendSchema.prefault({}),
  api: apiBackendSchema.prefault({}),
});

export type AutotitleSettings = z.output<typeof settingsSchema>;

export const autotitleSettings = defineSettings({
  id: "settings",
  scope: "host",
  version: 1,
  schema: settingsSchema,
});
