Agent auto-title 在新 agent 会话的第一轮正常结束后，根据首条请求和第一段回复生成一个「具体对象 + 主题」形式的简短标题，并把会话改成这个名字。首条只是寒暄、找不到具体任务时先不改名，等后续轮次（最多看前 3 条用户消息）再起名。Paseo 默认只用 prompt 第一行的前 60 个字符当标题，这个插件用来替换它。

只有当前名字仍等于 Paseo 由 prompt 截出的临时标题时才会改名，所以手动改过名、创建时用 `--title` 指定过名字的会话都不会被覆盖。子 agent（有 parent 的会话）默认跳过。插件只在第一轮结束后尝试，失败最多重试一次（在下一轮结束时），始终保留原名，错误写入 `paseo plugin logs agent-autotitle`。生成串行进行，同一时间只有一个请求。

## 设置

设置文件是 `~/.paseo/plugin-settings/agent-autotitle/settings.json`（不存在时全部使用默认值），格式为 `{"version": 1, "values": {...}}`。插件每次生成前都会重新读取，改完立即生效，不用 reload。

| 字段 | 默认值 | 说明 |
|---|---|---|
| `enabled` | `true` | 总开关 |
| `backend` | `"agent"` | `agent` 调本机已登录的 CLI，`api` 走 HTTP 接口 |
| `language` | `"简体中文"` | 标题语言 |
| `maxChars` | `16` | 目标长度上限，按汉字计、英文和数字算半个字；超过 1.5 倍才会被截断 |
| `includeSubagents` | `false` | 是否也给子 agent 改名 |
| `timeoutMs` | `90000` | 单次生成超时 |
| `paseoCommand` | `"paseo"` | 用于读名和改名的 Paseo CLI |

### agent 后端

`agent.cli` 为 `claude`（默认）或 `codex`，`agent.model` 留空时 claude 用 `haiku`、codex 用其配置里的默认模型，`agent.command` 可指定二进制绝对路径。claude 以 `-p` 运行，不带工具、MCP、项目设置和会话持久化，约 4–7 秒；codex 以 `exec --ephemeral -s read-only` 运行，约 12 秒，会执行 Codex 自身配置的 hooks。两者都消耗对应账号的额度。

### api 后端

```json
{
  "version": 1,
  "values": {
    "backend": "api",
    "api": {
      "format": "openai",
      "baseUrl": "https://example.com/v1",
      "model": "gpt-4o-mini",
      "apiKeyFile": "~/.config/paseo-autotitle/api-key",
      "extraBody": { "max_tokens": 64 }
    }
  }
}
```

`format` 为 `openai`（请求 `{baseUrl}/chat/completions`）或 `anthropic`（请求 `{baseUrl}/messages`），`baseUrl` 要带版本段 `/v1`。key 从 `apiKeyFile`（建议 0600）或 `apiKeyEnv` 指定的 daemon 环境变量读取，设置文件里不存放 key。`extraBody` 会合并进请求体，用于 `max_tokens`、`temperature` 或推理模型要求的参数。请求由 daemon 所在主机的 Node `fetch` 直接发出，不经过 `HTTP_PROXY`。

## 发送的数据

每个新会话通常发送一次，首条只是寒暄时会在后续轮次再发：首条请求（最多 3000 字符）、之后最多两条用户消息（各 800 字符）和第一轮回复的开头（最多 600 字符），发给所选 CLI 背后的服务或所配置的 API。
