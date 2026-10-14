import { execCommand } from "@getpaseo/plugin/server";

// The plugin-facing PaseoApi has no agent rename, so go through the local CLI,
// which talks to the same daemon over its local home.

export async function readAgentName(paseoCommand: string, agentId: string): Promise<string | null> {
  const { stdout } = await execCommand(paseoCommand, ["inspect", agentId, "--json"], {
    env: process.env,
    timeout: 20_000,
  });
  const parsed = JSON.parse(stdout) as { Name?: unknown };
  return typeof parsed.Name === "string" ? parsed.Name : null;
}

export async function renameAgent(paseoCommand: string, agentId: string, name: string): Promise<void> {
  await execCommand(paseoCommand, ["agent", "update", agentId, "--name", name], {
    env: process.env,
    timeout: 20_000,
  });
}
