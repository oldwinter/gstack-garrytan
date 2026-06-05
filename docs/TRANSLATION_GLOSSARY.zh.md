# 中文翻译术语表

本文件记录 gstack 中文版翻译时的固定术语。翻译自然语言说明时遵循本表；命令、路径、配置键、API 名、包名、人名、组织名、产品名、协议名和 URL 保持原文。

## 保留原文

| 原文 | 说明 |
|------|------|
| gstack / GStack | 项目和产品名，保持原文 |
| Claude Code | 产品名，保持原文 |
| OpenAI Codex / Codex CLI | 产品名，保持原文 |
| OpenClaw / Hermes / Cursor / Kiro / Slate / Factory Droid / GBrain | agent 或产品名，保持原文 |
| Bun / Node.js / Playwright / Chromium / Git / GitHub / Supabase / Tailscale / ngrok | 技术、产品或协议名，保持原文 |
| OWASP / STRIDE / CDP / MCP / ACP / PTY / SSE / WebSocket | 标准、协议或技术缩写，保持原文 |
| Diataxis / Pretext | 专有框架或方法名，保持原文 |
| `/skill-name`、`$B`、`gstack-*` | 命令和 skill 名保持原文 |

## 固定译法

| English | 中文 |
|---------|------|
| skill | skill |
| agent | agent |
| workflow | 工作流 |
| prompt | prompt |
| plan mode | Plan mode |
| sprint | sprint |
| slash command | slash command |
| headless browser | headless browser |
| headed browser | 可见浏览器 |
| browser daemon | 浏览器 daemon |
| sidebar | sidebar |
| guardrail | 护栏 |
| destructive command | 破坏性命令 |
| edit boundary / freeze boundary | 编辑边界 |
| generated file | 生成文件 |
| template | 模板 |
| eval / evaluation | eval |
| E2E | E2E |
| LLM-as-judge | LLM-as-judge |
| regression test | 回归测试 |
| staging URL | staging URL |
| production | production |
| deploy | 部署 |
| release | 发布 |
| telemetry | telemetry |
| analytics | analytics |
| memory / learnings | memory / learnings |
| worktree | worktree |
| fork | fork |

## 翻译策略

- 面向用户和 agent 的说明翻成中文，保持简洁、可执行。
- 代码块、shell 命令、JSON/YAML/TOML key、frontmatter 字段名、环境变量和路径不翻译。
- 表格列名可翻译；表格中的命令、flag 和产品名保持原文。
- License 法律文本不翻译，避免改变法律表达。
- 生成型 `SKILL.md` 的源头是 `.tmpl`；优先翻译 `.tmpl`，再通过生成流程同步输出。
