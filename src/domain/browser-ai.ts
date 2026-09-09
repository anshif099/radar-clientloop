export const browserAiModels = [
  "Llama-3.2-1B-Instruct-q4f16_1-MLC",
  "SmolLM2-360M-Instruct-q4f32_1-MLC",
] as const;
export const browserAiModel = browserAiModels[0];
export type BrowserAiModel = (typeof browserAiModels)[number];
export const maxBrowserAiReply = 14_000;

export interface BrowserAiRequest {
  question: string;
  sourceMessageId: number;
  clientMessageId: string;
  grounding: unknown;
}
