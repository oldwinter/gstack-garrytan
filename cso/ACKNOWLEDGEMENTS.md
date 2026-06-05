# Acknowledgements

/cso v2 参考了 security audit landscape 中的多项 research。致谢：

- **[Sentry Security Review](https://github.com/getsentry/skills)** — Confidence-based reporting system（只报告 HIGH confidence findings）和 "research before reporting" methodology（trace data flow、check upstream validation）验证了我们的 8/10 daily confidence gate。TimOnWeb 将它评为 5 个被测试 security skills 中唯一值得安装的一个。
- **[Trail of Bits Skills](https://github.com/trailofbits/skills)** — Audit-context-building methodology（hunt bugs 前先 build mental model）直接启发了 Phase 0。他们的 variant analysis concept（found one vuln? Search the whole codebase for the same pattern）启发了 Phase 12 的 variant analysis step。
- **[Shannon by Keygraph](https://github.com/KeygraphHQ/shannon)** — Autonomous AI pentester，在 XBOW benchmark 上达到 96.15%（100/104 exploits）。它验证了 AI 能做 real security testing，而不仅是 checklist scanning。我们的 Phase 12 active verification 是 Shannon live 能力的 static-analysis 版本。
- **[afiqiqmal/claude-security-audit](https://github.com/afiqiqmal/claude-security-audit)** — AI/LLM-specific security checks（prompt injection、RAG poisoning、tool calling permissions）启发了 Phase 7。其 framework-level auto-detection（检测 "Next.js"，而不只是 "Node/TypeScript"）启发了 Phase 0 的 framework detection step。
- **[Snyk ToxicSkills Research](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/)** — 其发现“36% 的 AI agent skills 存在 security flaws，13.4% 是 malicious”启发了 Phase 8（Skill Supply Chain scanning）。
- **[Daniel Miessler's Personal AI Infrastructure](https://github.com/danielmiessler/Personal_AI_Infrastructure)** — Incident response playbooks 和 protection file concept 影响了 remediation 与 LLM security phases。
- **[McGo/claude-code-security-audit](https://github.com/McGo/claude-code-security-audit)** — 生成 shareable reports 和 actionable epics 的 idea 影响了我们的 report format evolution。
- **[Claude Code Security Pack](https://dev.to/myougatheaxo/automate-owasp-security-audits-with-claude-code-security-pack-4mah)** — Modular approach（拆成 /security-audit、/secret-scanner、/deps-check skills）验证了这些确实是 distinct concerns。我们的 unified approach 为了 cross-phase reasoning 牺牲了一些 modularity。
- **[Anthropic Claude Code Security](https://www.anthropic.com/news/claude-code-security)** — Multi-stage verification 和 confidence scoring 验证了我们的 parallel finding verification approach。其在 open source 中发现了 500+ zero-days。
- **[@gus_argon](https://x.com/gus_aragon/status/2035841289602904360)** — 识别出 critical v1 blind spots：没有 stack detection（运行 all-language patterns）、使用 bash grep 而不是 Claude Code 的 Grep tool、`| head -20` 会 silently truncate results、以及 preamble bloat。这些直接塑造了 v2 的 stack-first approach 和 Grep tool mandate。
