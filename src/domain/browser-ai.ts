export const browserGpuAiModels = [
  "Llama-3.2-1B-Instruct-q4f16_1-MLC",
  "SmolLM2-360M-Instruct-q4f32_1-MLC",
] as const;
export const browserCpuAiModel = "onnx-community/SmolLM2-135M-Instruct-ONNX-MHA" as const;
export const browserAiModels = [...browserGpuAiModels, browserCpuAiModel] as const;
export const browserAiModel = browserGpuAiModels[0];
export type BrowserAiModel = (typeof browserAiModels)[number];
export type BrowserGpuAiModel = (typeof browserGpuAiModels)[number];
export type BrowserAiEngine = "webllm-webgpu" | "transformers-wasm";
export const maxBrowserAiReply = 14_000;

export interface BrowserAiRequest {
  question: string;
  sourceMessageId: number;
  clientMessageId: string;
  grounding: unknown;
}
