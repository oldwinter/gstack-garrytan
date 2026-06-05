# gstack — AI 工程工作流

gstack 是一组 `SKILL.md` 文件，用来给 AI agents 赋予结构化的软件开发角色。每个 skill 都是一位专家：CEO reviewer、eng manager、designer、QA lead、release engineer、debugger，等等。

## 可用 skills

skills 位于 `.agents/skills/`（在 Claude Code 中也可能位于 `~/.claude/skills/gstack/`）。按名称调用它们，例如 `/office-hours`。

### Plan-mode reviews（Plan mode 审查）

| Skill | 作用 |
|-------|-------------|
| `/office-hours` | 从这里开始。在写代码前重新框定你的产品想法。 |
| `/plan-ceo-review` | CEO 级 review：从需求中找出 10-star product。 |
| `/plan-eng-review` | 锁定架构、数据流、边界情况和测试。 |
| `/plan-design-review` | 对每个设计维度按 0-10 评分，并说明 10 分是什么样。 |
| `/plan-devex-review` | DX-mode review：TTHW、magical moments、摩擦点、persona traces。 |
| `/plan-tune` | 按问题自调 AskUserQuestion 灵敏度。 |
| `/autoplan` | 一个命令运行 CEO → design → eng → DX review。 |
| `/design-consultation` | 从零构建完整设计系统。 |
| `/spec` | 将模糊意图转成五阶段的精确可执行 spec。创建 GitHub issue，可选在新 worktree 中生成 Claude Code agent，并允许 `/ship` 在 merge 后关闭源 issue。 |

### 实现 + review

| Skill | 作用 |
|-------|-------------|
| `/review` | 落地前 PR review。寻找能通过 CI 但会在 production 中出问题的 bug。 |
| `/codex` | 通过 OpenAI Codex 获取 second opinion。支持 review、challenge 或 consult 模式。 |
| `/investigate` | 系统化 root-cause debugging。没有调查就不修复。 |
| `/design-review` | 对 live site 做视觉 audit，并用原子提交修复。 |
| `/design-shotgun` | 生成多个 AI 设计方案、对比板并迭代。 |
| `/design-html` | 生成 production-quality、Pretext-native 的 HTML/CSS。 |
| `/devex-review` | live developer experience audit（按真实流程测量 TTHW）。 |
| `/qa` | 打开真实浏览器，发现 bug，修复并重新验证。 |
| `/qa-only` | 与 `/qa` 方法相同，但只报告，不改代码。 |
| `/scrape` | 从网页抽取数据。第一次调用做原型；固化后的调用约 200ms 完成。 |
| `/skillify` | 将最近一次成功的 `/scrape` 流程固化成永久 browser-skill。 |

### 发布 + 部署

| Skill | 作用 |
|-------|-------------|
| `/ship` | 运行测试、review、push、打开 PR。支持 workspace-aware version queue。 |
| `/land-and-deploy` | merge PR，等待 CI 和部署，验证 production health。 |
| `/canary` | 使用 browse daemon 的部署后监控循环。 |
| `/landing-report` | workspace-aware ship queue 的只读 dashboard。 |
| `/document-release` | 更新所有文档，使其匹配刚刚发布的内容。 |
| `/document-generate` | 从代码生成 Diataxis 文档（tutorial / how-to / reference / explanation）。 |
| `/setup-deploy` | 一次性部署配置检测（Fly.io、Render、Vercel 等）。 |
| `/gstack-upgrade` | 将 gstack 更新到最新版本。 |

### 运营 + memory

| Skill | 作用 |
|-------|-------------|
| `/context-save` | 保存工作上下文（git state、决策、剩余工作）。 |
| `/context-restore` | 从保存的上下文恢复，即使跨 Conductor workspaces 也可以。 |
| `/learn` | 管理 gstack 跨会话学到的内容。 |
| `/retro` | 每周 retro，包含按人拆分和 shipping streaks。 |
| `/health` | 代码质量 dashboard（type checker、linter、tests、dead code）。 |
| `/benchmark` | 性能回归检测（page load、Core Web Vitals）。 |
| `/benchmark-models` | skills 的跨模型 benchmark（Claude、GPT、Gemini 并排）。 |
| `/cso` | OWASP Top 10 + STRIDE security audit。 |
| `/setup-gbrain` | 设置 gbrain，用于跨机器 session memory sync。 |
| `/sync-gbrain` | 让 gbrain 与本 repo 代码保持最新；刷新 CLAUDE.md 中的 agent search guidance。 |

### 浏览器 + agent 集成

| Skill | 作用 |
|-------|-------------|
| `/browse` | Headless browser：真实 Chromium、真实点击、约 100ms/command。 |
| `/open-gstack-browser` | 启动带 sidebar + stealth 的可见 GStack Browser。 |
| `/setup-browser-cookies` | 从真实浏览器导入 cookies，用于 authenticated testing。 |
| `/pair-agent` | 将远程 AI agent（OpenClaw、Codex 等）与你的浏览器配对。 |

### iOS QA — 通过 USB 或 Tailscale 驱动真实 iPhone（v1.43.0.0+）

| Skill | 作用 |
|-------|-------------|
| `/ios-qa` | 通过 USB CoreDevice tunnel + embedded StateServer 做 live-device iOS QA。可选通过 Tailscale 暴露设备，让远程 agents 驱动。 |
| `/ios-fix` | 自主 iOS bug fixer，带 regression snapshot capture。 |
| `/ios-design-review` | 在真实 iPhone 上做 designer's-eye QA，使用 10 维 Apple HIG rubric。 |
| `/ios-clean` | 便利工具：在 Release build 前剥离 DebugBridge + #if DEBUG wiring。 |
| `/ios-sync` | 根据最新 upstream templates 重新生成 iOS debug bridge。 |

配套 CLIs（在连接设备的 Mac 上运行）：

| Command | 作用 |
|---------|-------------|
| `gstack-ios-qa-daemon` | Mac-side broker。默认 loopback；`--tailnet` 增加面向 Tailscale 的 listener，带 capability tiers 和 audit logging。 |
| `gstack-ios-qa-mint` | tailnet allowlist 的 owner-grant CLI（`grant`/`revoke`/`list`）。 |

端到端 walkthrough：[docs/howto-ios-testing-with-gstack.md](docs/howto-ios-testing-with-gstack.md)。

### 安全 + 范围

| Skill | 作用 |
|-------|-------------|
| `/careful` | 在破坏性命令前警告（rm -rf、DROP TABLE、force-push）。 |
| `/freeze` | 将编辑锁定在一个目录。硬阻止，不只是警告。 |
| `/guard` | 同时激活 careful + freeze。 |
| `/unfreeze` | 移除目录编辑限制。 |
| `/make-pdf` | 将任意 Markdown 文件转成 publication-quality PDF。 |

## 构建命令

```bash
bun install              # 安装依赖
bun test                 # 运行免费测试（无 API 花费）
bun run test:windows     # 精选 Windows-safe 子集（在 windows-latest 上运行）
bun run build            # 生成文档并编译 binaries
bun run gen:skill-docs   # 从模板重新生成 SKILL.md 文件
bun run skill:check      # 所有 skills 的 health dashboard
```

## 平台支持

- **macOS** + **Linux**：支持完整测试套件。
- **Windows**：精选 Windows-safe 子集通过 `windows-free-tests` CI job 在 `windows-latest` 上运行。当前 setup script（`./setup`）需要 Git Bash 或 MSYS；原生 PowerShell 支持是未来扩展。`bin/gstack-paths` helper 通过 `CLAUDE_PLUGIN_DATA` / `GSTACK_HOME` 解析 state roots，因此 plugin install 可在每个平台工作。

## 关键约定

- `SKILL.md` 文件由 `.tmpl` 模板**生成**。编辑模板，不要编辑输出。
- 运行 `bun run gen:skill-docs --host codex` 可重新生成 Codex-specific 输出。
- browse binary 提供 headless browser 访问。在 skills 中使用 `$B <command>`。
- Safety skills（careful、freeze、guard）使用 inline advisory prose；执行破坏性操作前始终确认。
- State paths 通过 `bin/gstack-paths` 解析（用 `eval "$(...)"` source）。遵循 `GSTACK_HOME`、`CLAUDE_PLUGIN_DATA`、`CLAUDE_PLANS_DIR`。
- `claude` CLI binary 通过 `browse/src/claude-bin.ts` 解析（`Bun.which()` + `GSTACK_CLAUDE_BIN` override）。在 Windows 上设置 `GSTACK_CLAUDE_BIN=wsl` 加 `GSTACK_CLAUDE_BIN_ARGS='["claude"]'`，可通过 WSL 运行 Claude。
