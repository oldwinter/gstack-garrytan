# 向 gstack 添加新 Host

gstack 使用 declarative host config system。每个受支持的 AI coding agent
（Claude、Codex、Factory、Kiro、OpenCode、Slate、Cursor、OpenClaw）都定义为
typed TypeScript config object。添加新 host 意味着创建一个文件并 re-export 它。
Generator、setup 或 tooling 都不需要 code changes。

## 工作方式

```
hosts/
├── claude.ts        # Primary host
├── codex.ts         # OpenAI Codex CLI
├── factory.ts       # Factory Droid
├── kiro.ts          # Amazon Kiro
├── opencode.ts      # OpenCode
├── slate.ts         # Slate (Random Labs)
├── cursor.ts        # Cursor
├── openclaw.ts      # OpenClaw (hybrid: config + adapter)
└── index.ts         # Registry: imports all, derives Host type
```

每个 config file 都 export 一个 `HostConfig` object，告诉 generator：
- generated skills 放在哪里（paths）
- 如何 transform frontmatter（allowlist/denylist fields）
- 要 rewrite 哪些 Claude-specific references（paths、tool names）
- auto-install 时检测哪个 binary
- suppress 哪些 resolver sections
- install time symlink 哪些 assets

Generator、setup script、platform-detect、uninstall、health checks、worktree copy
和 tests 都读取这些 configs。它们都没有 per-host code。

## Step-by-step（分步）：添加新 host

### 1. 创建 config file

复制一个 existing config 作为起点。`hosts/opencode.ts` 是很好的 minimal example。
`hosts/factory.ts` 展示 tool rewrites 和 conditional fields。`hosts/openclaw.ts`
展示不同 tool models 的 hosts 所需的 adapter pattern。

创建 `hosts/myhost.ts`：

```typescript
import type { HostConfig } from '../scripts/host-config';

const myhost: HostConfig = {
  name: 'myhost',
  displayName: 'MyHost',
  cliCommand: 'myhost',        // 用于 `command -v` detection 的 binary name
  cliAliases: [],              // alternative binary names

  globalRoot: '.myhost/skills/gstack',
  localSkillRoot: '.myhost/skills/gstack',
  hostSubdir: '.myhost',
  usesEnvVars: true,           // false only for Claude (uses literal ~ paths)

  frontmatter: {
    mode: 'allowlist',         // 'allowlist' 只保留 listed fields
    keepFields: ['name', 'description'],
    descriptionLimit: null,    // 对有限制的 hosts 设为 1024
  },

  generation: {
    generateMetadata: false,   // 仅 Codex 为 true（openai.yaml）
    skipSkills: ['codex'],     // codex skill 是 Claude-only
  },

  pathRewrites: [
    { from: '~/.claude/skills/gstack', to: '~/.myhost/skills/gstack' },
    { from: '.claude/skills/gstack', to: '.myhost/skills/gstack' },
    { from: '.claude/skills', to: '.myhost/skills' },
  ],

  runtimeRoot: {
    globalSymlinks: ['bin', 'browse/dist', 'browse/bin', 'gstack-upgrade', 'ETHOS.md'],
    globalFiles: { 'review': ['checklist.md', 'TODOS-format.md'] },
  },

  install: {
    prefixable: false,
    linkingStrategy: 'symlink-generated',
  },

  learningsMode: 'basic',
};

export default myhost;
```

### 2. 在 index 中注册

编辑 `hosts/index.ts`：

```typescript
import myhost from './myhost';

// 添加到 ALL_HOST_CONFIGS array：
export const ALL_HOST_CONFIGS: HostConfig[] = [
  claude, codex, factory, kiro, opencode, slate, cursor, openclaw, myhost
];

// 添加到 re-exports：
export { claude, codex, factory, kiro, opencode, slate, cursor, openclaw, myhost };
```

### 3. 添加到 .gitignore

把 `.myhost/` 添加到 `.gitignore`（generated skill docs 会被 gitignored）。

### 4. 生成并验证

```bash
# 为 new host 生成 skill docs
bun run gen:skill-docs --host myhost

# 验证 output 存在且没有 .claude/skills leakage
ls .myhost/skills/gstack-*/SKILL.md
grep -r ".claude/skills" .myhost/skills/ | head -5
# （应为空）

# 为所有 hosts 生成（包含 new one）
bun run gen:skill-docs --host all

# Health dashboard 显示 new host
bun run skill:check
```

### 5. Run tests

```bash
bun test test/gen-skill-docs.test.ts
bun test test/host-config.test.ts
```

Parameterized smoke tests 会自动 pick up new host。无需写 test code。它们会验证：
output exists、no path leakage、valid frontmatter、freshness check passes、codex skill excluded。

### 6. 更新 README.md

在相应 section 为 new host 添加 install instructions。

## Config field reference（配置字段参考）

完整 `HostConfig` interface 见 `scripts/host-config.ts`，其中每个 field 都有 JSDoc comments。

Key fields（关键字段）：

| Field（字段） | 用途 |
|-------|---------|
| `frontmatter.mode` | `allowlist`（只保留 listed）或 `denylist`（strip listed） |
| `frontmatter.descriptionLimit` | Max chars，`null` 表示 no limit |
| `frontmatter.descriptionLimitBehavior` | `error`（fail build）、`truncate`、`warn` |
| `frontmatter.conditionalFields` | 根据 template values 添加 fields（例如 sensitive -> disable-model-invocation） |
| `frontmatter.renameFields` | Rename template fields（例如 voice-triggers -> triggers） |
| `pathRewrites` | 对 content 做 literal replaceAll。Order matters。 |
| `toolRewrites` | Rewrite Claude tool names（例如 "use the Bash tool" -> "run this command"） |
| `suppressedResolvers` | 对该 host 返回 empty 的 resolver functions |
| `coAuthorTrailer` | Commits 使用的 Git co-author string |
| `boundaryInstruction` | Cross-model invocations 的 anti-prompt-injection warning |
| `adapter` | Complex transformations 的 adapter module path |

## Adapter pattern（用于不同 tool models 的 hosts）

如果 string-replace tool rewrites 不够用（host 有 fundamentally different tool semantics），
使用 adapter pattern。见 `hosts/openclaw.ts` 和
`scripts/host-adapters/openclaw-adapter.ts`。

Adapter 会在所有 generic rewrites 之后作为 post-processing step 运行。它 export
`transform(content: string, config: HostConfig): string`。

## Validation（验证）

`scripts/host-config.ts` 中的 `validateHostConfig()` function 会检查：
- Name：lowercase alphanumeric with hyphens
- CLI command：alphanumeric with hyphens/underscores
- Paths：仅 safe characters（alphanumeric、`.`、`/`、`$`、`{}`、`~`、`-`、`_`）
- Configs 之间没有 duplicate names、hostSubdirs 或 globalRoots

运行 `bun run scripts/host-config-export.ts validate` 检查所有 configs。
