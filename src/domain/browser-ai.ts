export const browserAiModel = "Qwen3.5-2B-q4f16_1-MLC";
export const maxBrowserAiReply = 14_000;

export interface BrowserAiRequest {
  question: string;
  sourceMessageId: number;
  clientMessageId: string;
  grounding: unknown;
}
