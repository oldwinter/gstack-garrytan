

export function generateLakeIntro(): string {
  return `如果 \`LAKE_INTRO\` 是 \`no\`：说 "gstack 遵循 **Boil the Ocean** principle：当 AI 让边际成本接近 0 时，就把完整的事做完。Read more: https://garryslist.org/posts/boil-the-ocean"。询问是否打开：

\`\`\`bash
open https://garryslist.org/posts/boil-the-ocean
touch ~/.gstack/.completeness-intro-seen
\`\`\`

只有用户同意时才运行 \`open\`。始终运行 \`touch\`。`;
}
