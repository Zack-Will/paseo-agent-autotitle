import type { PluginLifecycleEvents } from "@getpaseo/plugin/server";

type Timeline = PluginLifecycleEvents["agent.turn_ended"]["timeline"];

const MAX_PROMPT_CHARS = 3000;
const MAX_FOLLOWUP_CHARS = 800;
const MAX_REPLY_CHARS = 600;
// A session that opens with small talk gets its task from a later message.
export const MAX_REQUESTS = 3;

export interface TitleContext {
  // The first user message, kept whole so Paseo's provisional title can be recognised.
  firstPrompt: string;
  // The first few user messages, clipped, as material for the title.
  requests: string[];
  // Assistant text from the first turn only.
  firstReply: string;
}

export function extractTitleContext(timeline: Timeline): TitleContext | null {
  const requests: string[] = [];
  const replies: string[] = [];
  for (const item of timeline) {
    if (item.type === "user_message") {
      const text = item.text.trim();
      if (!text) continue;
      if (requests.length === MAX_REQUESTS) break;
      requests.push(text);
    } else if (item.type === "assistant_message" && requests.length === 1) {
      const text = item.text.trim();
      if (text) replies.push(text);
    }
  }
  if (requests.length === 0) return null;
  return {
    firstPrompt: requests[0],
    requests: requests.map((text, index) => clip(text, index === 0 ? MAX_PROMPT_CHARS : MAX_FOLLOWUP_CHARS)),
    firstReply: clip(replies.join("\n\n"), MAX_REPLY_CHARS),
  };
}

// The model answers this when the opening has no recognisable task yet.
export const SKIP_TOKEN = "SKIP";

export function isSkip(raw: string): boolean {
  return raw.trim().replace(/[。.!！]+$/, "").toUpperCase() === SKIP_TOKEN;
}

// Mirrors deriveInitialAgentTitle in @getpaseo/server (agent/create-agent-title.js):
// the first non-empty line of the prompt, whitespace collapsed, cut at 60 chars.
export function derivePromptTitle(prompt: string): string | null {
  const firstLine = prompt
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return null;
  const clamped = firstLine.replace(/\s+/g, " ").trim().slice(0, 60).trim();
  return clamped || null;
}

// Lines where the model restates the rules or opens with filler instead of answering.
const META_LINE = /标题要求|个字符|个汉字|只输出|以下是|如下[:：]?$|^好的|^here(?: is|'s)|^sure\b/i;

export function sanitizeTitle(raw: string, maxChars: number): string | null {
  const line = raw
    .split(/\r?\n/)
    .map((part) => part.trim())
    .find((part) => part.length > 0 && !META_LINE.test(part));
  if (!line) return null;
  const cleaned = line
    .replace(/^(标题|title)\s*[:：]\s*/i, "")
    .replace(/^[#*\s]+/, "")
    .replace(/^["'`“”‘’《「『]+|["'`“”‘’》」』*]+$/g, "")
    .replace(/[。．.!！?？;；,，、]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  // maxChars is the target given to the model; only clearly runaway output is cut.
  return truncateTitle(cleaned, Math.ceil(maxChars * 1.5)) || null;
}

// Width is measured in CJK characters; ASCII counts as half, so mixed titles such as
// "git push 报 permission denied" are not cut mid-word. Overflow backs up to a word edge.
function truncateTitle(title: string, maxChars: number): string {
  const chars = Array.from(title);
  let width = 0;
  let end = 0;
  for (; end < chars.length; end++) {
    width += /[\x20-\x7e]/.test(chars[end]) ? 0.5 : 1;
    if (width > maxChars) break;
  }
  if (end === chars.length) return title;
  let cut = end;
  const isWordChar = (char: string | undefined) => !!char && /[A-Za-z0-9_.-]/.test(char);
  if (isWordChar(chars[cut]) && isWordChar(chars[cut - 1])) {
    while (cut > 0 && isWordChar(chars[cut - 1])) cut--;
    if (cut === 0) cut = end;
  }
  return chars.slice(0, cut).join("").replace(/[\s(（:：,，、-]+$/, "").trim();
}

function clip(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length <= max ? text : chars.slice(0, max).join("") + "…";
}
