# AskUserQuestion — non-ASCII / CJK characters

当 AskUserQuestion 包含中文（繁體/簡體）、Japanese、Korean 或其他 non-ASCII text 时，
按需读取本文。实际生效规则位于 always-loaded AskUserQuestion self-check：
"Non-ASCII characters written directly, NOT \u-escaped"；本文给出完整 rationale。

## 规则

当任何 string field（question、option label、option description）包含 non-ASCII text
时，在 JSON string 中输出 literal UTF-8 characters。**绝不要 escape 成 `\uXXXX`。**

Claude Code 的 tool parameter pipe 原生支持 UTF-8，会原样传递字符。只有 JSON-mandatory
escapes 仍允许：`\n`、`\t`、`\"`、`\\`。

## 为什么 escaping 会失败

手工 escaping 需要从训练中回忆每个 codepoint；对长 CJK strings 这并不可靠，model
经常输出错误 codepoint。例子：把 `㄃` 当成 管（U+7BA1）写出，但 `㄃` 实际就是 ㄃，
于是用户看到的 `管理工具` 会渲染成 `㄃3用箱`。

触发场景通常是包含数百个 CJK characters 的 long multi-line questions：这正是
reflexive escaping 最容易发生、miscoding 破坏性最大的时候。Long != escape。保持
characters literal。

- Wrong: `"question": "請選擇\uXXXX\uXXXX\uXXXX\uXXXX"`
- Right: `"question": "請選擇管理工具"`
