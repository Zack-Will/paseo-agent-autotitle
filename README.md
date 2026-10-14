# paseo-agent-autotitle

[Paseo](https://paseo.sh) 插件：新 agent 会话第一轮结束后，根据首条请求生成一个简短的名词短语标题（如「cxl1 根盘占用排查」「Zotero collection PDF 批量导出脚本」），替换 Paseo 默认用 prompt 开头当标题的做法，方便在会话列表里找回之前的会话。

## 安装

```sh
paseo plugin install https://github.com/Zack-Will/paseo-agent-autotitle
# 或
paseo plugin install github:Zack-Will/paseo-agent-autotitle
```

需要 Paseo 0.11.2 及以上，并在 Paseo 设置里打开第三方插件（即 `~/.paseo/config.json` 中的 `"pluginsEnabled": true`）。安装时 Paseo 会在插件目录里执行 `npm ci`，因此 daemon 所在主机需要有 Node.js 和 npm。

## 工作方式

- 默认调用本机已登录的 `claude` CLI（haiku）生成标题，不需要额外配置；也可以改用 `codex` CLI，或任意 OpenAI / Anthropic 兼容的 HTTP 接口。
- 只改名仍是 Paseo 临时标题的会话：手动改过名或创建时指定了标题的会话不会被覆盖，子 agent 默认跳过。
- 首条消息只是寒暄时先不改名，等后续消息里出现具体任务再起名。
- 运行日志：`paseo plugin logs agent-autotitle`。

设置项、两种后端的配置方法以及发送了哪些数据，见 [OVERVIEW.md](OVERVIEW.md)。

## 开发

```sh
npm install
npm run typecheck
paseo plugin install /path/to/paseo-agent-autotitle   # 本地目录安装，改完执行 paseo plugin reload agent-autotitle
```
