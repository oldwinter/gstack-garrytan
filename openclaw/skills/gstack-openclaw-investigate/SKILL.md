---
name: gstack-openclaw-investigate
description: 当用户要求 debug、fix bug、investigate error、做 root cause analysis，或报告 errors、stack traces、unexpected behavior、某个东西停止工作时使用。
---

# Systematic Debugging（系统化调试）

## Iron Law（铁律）

**没有 root cause investigation，就不要修复。**

修 symptom 会制造 whack-a-mole debugging。每个没有解决 root cause 的 fix，都会让下一个 bug 更难找。先找到 root cause，再修复它。

---

## Phase 1：Root Cause Investigation

形成任何 hypothesis 之前，先收集 context。

1. **收集 symptoms：**阅读 error messages、stack traces 和 reproduction steps。如果用户提供的 context 不够，一次只问一个问题。不要一次问五个问题。

2. **读代码：**从 symptom 反向追踪 code path，到可能的 causes。搜索所有 references，阅读 failure point 周围的 logic。

3. **检查 recent changes：**
   ```bash
   git log --oneline -20 -- <affected-files>
   ```
   之前是否正常？发生了什么变化？Regression 意味着 root cause 在 diff 里。

4. **Reproduce：**能否 deterministic 地触发 bug？如果不能，继续收集 evidence，再往下走。

5. **检查 memory** 中同一区域的 prior debugging sessions。同一批文件反复出 bug 是 architectural smell。

输出：**"Root cause hypothesis: ..."**（保留 exact prefix），后面给出一个关于哪里错了、为什么错的 specific、testable claim。

---

## Phase 2：Pattern Analysis

检查这个 bug 是否匹配 known pattern：

**Race condition**：间歇性、timing-dependent。查看 shared state 的 concurrent access。

**Nil/null propagation**：NoMethodError、TypeError。Optional values 缺少 guards。

**State corruption**：数据不一致、partial updates。检查 transactions、callbacks、hooks。

**Integration failure**：timeout、unexpected response。检查 external API calls、service boundaries。

**Configuration drift**：本地能跑，staging / prod 失败。检查 env vars、feature flags、DB state。

**Stale cache**：显示旧数据，清 cache 后恢复。检查 Redis、CDN、browser cache。

同时检查：
- 项目中与相关问题有关的 known issues
- Git log 中同一区域的 prior fixes。同一批文件反复出 bug 是 architectural smell，不是巧合。

**External search：**如果 bug 不匹配 known pattern，在线搜索 error type。**先 sanitize：**移除 hostnames、IPs、file paths、SQL、customer data。搜索 error category，不要搜索 raw message。

---

## Phase 3：Hypothesis Testing

写任何 fix 之前，先验证 hypothesis。

1. **确认 hypothesis：**在疑似 root cause 处添加 temporary log statement、assertion 或 debug output。运行 reproduction。Evidence 是否匹配？

2. **如果 hypothesis 错了：**搜索 error（先 sanitize sensitive data）。回到 Phase 1。收集更多 evidence。不要猜。

3. **3-strike rule：**如果 3 个 hypotheses 都失败，**STOP**。告诉用户：

   "3 hypotheses tested, none match. This may be an architectural issue rather than a simple bug."
   （中文语义：已经测试 3 个 hypotheses，但都不匹配。这可能是 architectural issue，而不是 simple bug。）

   Options：
   - 用新的 hypothesis 继续调查（说明它是什么）
   - Escalate for human review（需要了解系统的人）
   - Add logging and wait（instrument 该区域，下次捕获）

**Red flags**：如果看到以下任一情况，放慢：
- "Quick fix for now"：没有 "for now"。正确修复，或 escalate。
- 在 trace data flow 前提出 fix：你在猜。
- 每次 fix 都暴露 elsewhere 的新问题：错的是 layer，不是某行 code。

---

## Phase 4：Implementation

确认 root cause 后：

1. **修 root cause，不修 symptom。**用消除实际问题的最小变更。

2. **Minimal diff：**触碰最少文件、改最少行。抵抗顺手 refactor adjacent code 的冲动。

3. **写 regression test**，它必须：
   - 没有 fix 时 **失败**（证明 test 有意义）
   - 有 fix 时 **通过**（证明 fix 有效）

4. **运行完整 test suite。**不允许 regression。

5. **如果 fix touches >5 files：**继续前先向用户标出 blast radius。对 bug fix 来说这已经很大。

---

## Phase 5：Verification & Report

**Fresh verification：**重新 reproduce 原始 bug scenario，并确认已修复。这不是可选项。

运行 test suite。

输出 structured debug report：

**DEBUG REPORT**
- **Symptom（症状）：** 用户观察到什么
- **Root cause（根因）：** 实际哪里错了
- **Fix（修复）：** 改了什么，附 file references
- **Evidence（证据）：** test output、reproduction，用来证明 fix 有效
- **Regression test（回归测试）：** new test 的位置
- **Related（相关）：** 同一区域 prior bugs、architectural notes
- **Status（状态）：** DONE | DONE_WITH_CONCERNS | BLOCKED

用今天日期把 report 保存到 `memory/`，供未来 sessions reference。

---

## 重要规则

- **3+ failed fix attempts：STOP 并质疑 architecture。** 这通常是 wrong architecture，而不是 failed hypothesis。
- **永远不要应用无法验证的 fix。** 如果不能 reproduce 并 confirm，就不要 ship。
- **永远不要说 "this should fix it."** Verify and prove it。Run the tests。
- **如果 fix touches >5 files：** proceed 前先 flag 给用户。
- **Completion status：**
  - DONE ... root cause 已找到，fix 已应用，regression test 已写，所有 tests pass
  - DONE_WITH_CONCERNS ... 已修复但无法 fully verify（例如 intermittent bug、requires staging）
  - BLOCKED ... investigation 后 root cause 仍不清楚，已 escalated
