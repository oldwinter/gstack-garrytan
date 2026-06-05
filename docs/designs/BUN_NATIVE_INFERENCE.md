# Bun-Native Prompt Injection Classifier — Research Plan（研究计划）

**Status（状态）：** P3 research / early prototype
**Branch（分支）：** `garrytan/prompt-injection-guard`
**Skeleton（骨架）：** `browse/src/security-bunnative.ts`
**TODOS anchor（TODOS 锚点）：** "Bun-native 5ms DeBERTa inference (XL, P3 / research)"

## 它解决的问题

Compiled `browse/dist/browse` binary 无法 link `onnxruntime-node`，因为 Bun 的 `--compile` 会产出 single-file executable，它从 temp extract dir `dlopen` dependencies，而 native .dylib loading 会在该 dir 失败（documented oven-sh/bun#3574、#18079，并在 CEO plan §Pre-Impl Gate 1 verified）。

当前 mitigation（branch-2 architecture）：ML classifier 只在 `sidebar-agent.ts`（non-compiled bun script）中通过 `@huggingface/transformers` 运行。Server.ts（compiled）没有 ML，只依赖 canary + architectural controls（XML framing + command allowlist）。

Branch-2 的问题：classifier 只能 scan sidebar-agent 能看到的内容。任何留在 compiled binary 内部的 content path（direct user input on its way out、canary check only）都会 miss ML layer。

从零实现的 Bun-native classifier，不使用 native modules，不使用 onnxruntime，可以让 compiled binary 在所有位置运行 full ML defense。

## Target numbers（目标指标）

| Metric（指标） | Current（当前，non-compiled Bun 中的 WASM） | Target（目标，Bun-native） |
|---|---|---|
| Cold-start | ~500ms (WASM init) | <100ms (embeddings mmap'd) |
| Steady-state p50 | ~10ms | ~5ms |
| Steady-state p95 | ~30ms | ~15ms |
| Works in compiled binary | NO | YES (primary goal) |
| macOS arm64 | ok (WASM) | target-first |
| macOS x64 | ok (WASM) | stretch |
| Linux amd64 | ok (WASM) | stretch |

## 架构

三个 building blocks，按 leverage 排序：

### 1. Tokenizer（DONE，已在 security-bunnative.ts shipped）

Pure-TS WordPiece encoder，直接读取 HuggingFace `tokenizer.json`，并生成与 transformers.js 对 BERT-small vocab 产出的相同 `input_ids` sequence。

**为什么 native tokenizer 本身就重要：** transformers.js path 中 tokenization 会分配大量 small arrays。我们的 pure-TS version 跳过 Tensor-allocation overhead。Tokenizer alone 有 modest speedup（约 5x），但更重要的是移除 async boundary，因此 cold path 从 zero dynamic imports 开始。

**Test coverage：** `browse/test/security-bunnative.test.ts` assert 我们的 `input_ids` 在 20 个 fixture strings 上 matches transformers.js output。

### 2. Forward pass（RESEARCH，multi-week）

Hard part。BERT-small 有：
  * 12 transformer layers
  * Hidden size 512, attention heads 8
  * ~30M params total

每次 forward pass：
  1. Embedding lookup（ids -> 512-dim vectors）
  2. Positional encoding add
  3. 12 x (self-attention + FFN + LayerNorm)
  4. Pooler（CLS token projection）
  5. Classifier head（2-way sigmoid）

Hot path 是每个 transformer layer 中的 12 matmuls。每个约为 512x512x{seq_len}。当 seq_len=128 时，是约 100 个 shape (128, 512) @ (512, 512) 的 matmuls。

**Two viable approaches（两个可行路径）：**

**Approach A：Pure-TS with Float32Array + SIMD**
  * 使用 Bun typed array support + SIMD intrinsics（当它们进入 Bun stable，目前 wasm-only）
  * Implementation：约 2000 LOC careful numerics。LayerNorm、GELU、softmax、scaled dot-product attention 都 hand-written。
  * Latency estimate：M-series 上约 30-50ms（明显慢于使用 WebAssembly SIMD 的 WASM）
  * VERDICT（结论）：standalone 不值得。Pure-TS 在 matmul 上打不过 WASM。

**Approach B：Bun FFI + Apple Accelerate**
  * 使用 `bun:ffi` 调 Apple Accelerate framework（cblas_sgemm）。M-series 上，768x768 matmul 的 cblas_sgemm 约 0.5ms。
  * Weights 存为 Float32Array（startup 时从 ONNX initializer tensors loaded），tokenizer 用 TS，matmul 通过 FFI，activations 用 pure TS。
  * Implementation：约 1000 LOC。Numerics 相同，但 bulk work offloaded to BLAS。
  * Latency estimate：3-6ms p50（meets target）。
  * RISK（风险）：macOS-only。Linux 需要通过 FFI 使用 OpenBLAS（symbol layout 不同）。Windows 是另一个故事。
  * VERDICT（结论）：对 macOS-first gstack 可行。匹配我们现有 ship posture（compiled binaries 只面向 Darwin arm64）。

**Approach C：WebGPU in Bun**
  * Bun 1.1.x 获得 WebGPU support。transformers.js 已有 WebGPU backend。能否 route native Bun through it？
  * RISK（风险）：macOS headless server context 中的 WebGPU 需要 proper display context。不确定 compiled bun binary 能否工作。
  * STATUS（状态）：unexplored。可能是 winning path，值得 spike。

### 3. Weight loading（EASY，已 shipped）

ONNX initializer tensors 可以在 build time extract 一次，成为 flat binary blob，供 `bun:ffi` `mmap()`。Net result：runtime zero decompression。Skeleton 还未这样做（当前通过 transformers.js load），但 plan 足够简单：一旦选择 Approach B，weight loader 会是第一个要 build 的东西。

## Milestones（里程碑）

1. **Tokenizer + bench harness**（SHIPPED）
   Tokenizer 通过 correctness test。Benchmark 记录 current WASM baseline：10ms p50。

2. **Bun FFI proof-of-concept**：从 Apple Accelerate 调 `cblas_sgemm`，time 一个 768x768 matmul。确认 <1ms latency。

3. **Single transformer layer in FFI**：为 Q/K/V projections 调 cblas_sgemm，在 TS 中实现 LayerNorm + softmax。与相同 input_ids 上的 onnxruntime output 比较。必须 match within 1e-4 absolute error。

4. **Full forward pass**：wire all 12 layers + pooler + classifier。Across 100 fixture strings against onnxruntime 做 correctness。

5. **Production swap**：替换 security-bunnative.ts 中的 `classify()` body。删除 WASM fallback。

6. **Quantization**：通过 Accelerate 的 cblas_sgemv_u8s8（如果 available）做 int8 matmul，或 fallback 到 onnxruntime-extensions。约 50% memory reduction，marginal speed win。

## 为什么不在 v1 直接 ship

Correctness 是问题。重新实现 pretrained transformer 的 floating-point logic 是 MULTI-WEEK engineering effort，每个 op 都需要与 reference epsilon-level agreement。LayerNorm epsilon 写错，accuracy 会 silent drift。Softmax overflow handling 写错，classifier 在 long inputs 上会产生 garbage。

把它塞进 P0 security feature 的 PR 是错误 risk allocation。现在先 ship WASM path（done），prove interface（通过 `classify()` shipped），然后把 native 作为 follow-up PR incremental land，并带自己的 correctness-regression test suite。

## Benchmark（基准测试）

Current baseline（来自 `browse/test/security-bunnative.test.ts` benchmark mode，在 Apple M-series 上 measured；其他 hardware YMMV）：

| Backend（后端） | p50 | p95 | p99 | Notes（说明） |
|---|---|---|---|---|
| transformers.js (WASM) | ~10ms | ~30ms | ~80ms | After warmup |
| bun-native (stub — delegates) | same as WASM | | | Matches by design |

当 Approach B（Accelerate FFI）land 后，这一 row 会用新 numbers refresh，并在 commit message 中 flag delta。
