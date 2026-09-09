import { pipeline, type ProgressInfo } from "@huggingface/transformers";
import { browserCpuAiModel } from "@/domain/browser-ai";

type ChatEntry = { role: "system" | "user" | "assistant"; content: string };
type CpuRequest = { id: string; messages: ChatEntry[] };
type CpuResponse =
  | { id: string; type: "progress"; percent: number; text: string }
  | { id: string; type: "result"; body: string }
  | { id: string; type: "error"; error: string };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<CpuRequest>) => void) | null;
  postMessage: (message: CpuResponse) => void;
};

let generatorPromise: ReturnType<typeof createGenerator> | null = null;

function describeFailure(error: unknown) {
  return error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown CPU model error";
}

function progressFor(id: string, info: ProgressInfo) {
  const percent = info.status === "progress" || info.status === "progress_total" ? Math.round(info.progress) : info.status === "ready" ? 100 : 0;
  const text = info.status === "ready" ? "CPU model ready" : info.status === "progress" || info.status === "progress_total" ? "Downloading private CPU model" : "Loading private CPU model";
  workerScope.postMessage({ id, type: "progress", percent, text });
}

async function createGenerator(id: string) {
  return pipeline("text-generation", browserCpuAiModel, {
    device: "wasm",
    dtype: "q4",
    progress_callback: (info) => progressFor(id, info),
  });
}

workerScope.onmessage = async ({ data }) => {
  try {
    generatorPromise ??= createGenerator(data.id).catch((error) => {
      generatorPromise = null;
      throw error;
    });
    const generator = await generatorPromise;
    workerScope.postMessage({ id: data.id, type: "progress", percent: 100, text: "Answering with your CPU..." });
    const output = await generator(data.messages, {
      max_new_tokens: 280,
      do_sample: false,
      repetition_penalty: 1.08,
    });
    const generated = output[0]?.generated_text;
    const content = Array.isArray(generated) ? generated.at(-1)?.content : generated;
    const answer = typeof content === "string" ? content : content?.map((part) => "text" in part && typeof part.text === "string" ? part.text : "").join("");
    if (!answer?.trim()) throw new Error("The CPU model returned an empty answer.");
    workerScope.postMessage({ id: data.id, type: "result", body: answer.trim() });
  } catch (error) {
    workerScope.postMessage({ id: data.id, type: "error", error: describeFailure(error) });
  }
};
