import type { PluginServerContext } from "@getpaseo/plugin/server";
import { autotitleSettings } from "./shared/settings";
import {
  MAX_REQUESTS,
  derivePromptTitle,
  extractTitleContext,
  isSkip,
  sanitizeTitle,
  type TitleContext,
} from "./server/context";
import { buildTitlePrompt, generateTitle } from "./server/generate";
import { readAgentName, renameAgent } from "./server/paseo";

const MAX_ATTEMPTS = 2;

export default function contribute(server: PluginServerContext) {
  const settings = server.registerSettings(autotitleSettings);
  // Agents that are renamed, renamed by hand, or out of attempts. A daemon restart
  // clears it, and the name check below keeps that safe.
  const finished = new Set<string>();
  const attempts = new Map<string, number>();
  const pending = new Set<string>();
  // One generation at a time so a burst of new agents does not fan out CLI processes.
  let queue: Promise<void> = Promise.resolve();

  async function autotitle(agentId: string, parentAgentId: string | null, context: TitleContext) {
    const state = await settings.read();
    if (state.status !== "ready") {
      console.error(`[autotitle] settings invalid: ${state.error}`);
      return;
    }
    const config = state.values;
    if (!config.enabled) return;
    if (parentAgentId && !config.includeSubagents) {
      console.log(`[autotitle] ${agentId} skipped: subagent of ${parentAgentId}`);
      finished.add(agentId);
      return;
    }

    const promptTitle = derivePromptTitle(context.firstPrompt);
    if (!(await stillPromptTitled(config.paseoCommand, agentId, promptTitle))) {
      console.log(`[autotitle] ${agentId} skipped: already renamed`);
      finished.add(agentId);
      return;
    }

    const attempt = (attempts.get(agentId) ?? 0) + 1;
    attempts.set(agentId, attempt);
    if (attempt >= MAX_ATTEMPTS) finished.add(agentId);

    const backend = config.backend === "api" ? `api:${config.api.format}` : `agent:${config.agent.cli}`;
    const startedAt = Date.now();
    const raw = await generateTitle(buildTitlePrompt(context, config), config);
    if (isSkip(raw)) {
      // Not a failure: wait for a later turn to bring the actual task, up to MAX_REQUESTS messages.
      attempts.set(agentId, attempt - 1);
      if (context.requests.length < MAX_REQUESTS) finished.delete(agentId);
      else finished.add(agentId);
      console.log(`[autotitle] ${agentId} no task yet after ${context.requests.length} message(s)`);
      return;
    }
    const title = sanitizeTitle(raw, config.maxChars);
    if (!title) throw new Error(`${backend} returned an empty title`);

    // The user may have renamed the agent while the title was being generated.
    if (!(await stillPromptTitled(config.paseoCommand, agentId, promptTitle))) {
      finished.add(agentId);
      return;
    }
    await renameAgent(config.paseoCommand, agentId, title);
    finished.add(agentId);
    console.log(`[autotitle] ${agentId} -> ${title} (${backend}, ${Date.now() - startedAt}ms)`);
  }

  const off = server.on("agent.turn_ended", (event) => {
    if (event.outcome.kind !== "completed") return;
    const agentId = event.agent.id;
    if (finished.has(agentId) || pending.has(agentId)) return;
    const context = extractTitleContext(event.timeline);
    if (!context) return;

    pending.add(agentId);
    queue = queue
      .then(() => autotitle(agentId, event.agent.parentAgentId, context))
      .catch((error: unknown) => {
        console.error(`[autotitle] ${agentId} failed: ${error instanceof Error ? error.message : String(error)}`);
      })
      .finally(() => pending.delete(agentId));
  });

  return () => off();
}

async function stillPromptTitled(paseoCommand: string, agentId: string, promptTitle: string | null) {
  const current = await readAgentName(paseoCommand, agentId);
  if (!current) return true;
  return promptTitle !== null && normalize(current) === normalize(promptTitle);
}

function normalize(title: string) {
  return title.replace(/\s+/g, " ").trim();
}
