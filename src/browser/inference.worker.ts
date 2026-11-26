/// <reference lib="webworker" />
import * as ort from "onnxruntime-web";

interface RunMessage {
  type: "run";
  id: number;
  modelUrl: string;
  wasmBase: string;
  locA: number[];
  timeA: number[];
  stampA: number[];
  locB: number[];
  timeB: number[];
  stampB: number[];
  maskRatio: number;
}

const sessions = new Map<string, Promise<ort.InferenceSession>>();

function int64(values: number[], dims: number[]): ort.Tensor {
  return new ort.Tensor("int64", BigInt64Array.from(values.map((value) => BigInt(value))), dims);
}

async function sessionFor(modelUrl: string, wasmBase: string) {
  let pending = sessions.get(modelUrl);
  if (!pending) {
    ort.env.wasm.wasmPaths = wasmBase;
    ort.env.wasm.numThreads = 1;
    pending = ort.InferenceSession.create(modelUrl, { executionProviders: ["wasm"] });
    sessions.set(modelUrl, pending);
  }
  return pending;
}

self.onmessage = async (event: MessageEvent<RunMessage>) => {
  const message = event.data;
  if (message.type !== "run") return;
  try {
    const started = performance.now();
    const session = await sessionFor(message.modelUrl, message.wasmBase);
    const loadMs = performance.now() - started;
    const runStarted = performance.now();
    const result = await session.run({
      loc_a: int64(message.locA, [1, message.locA.length]),
      tim_a: int64(message.timeA, [1, message.timeA.length]),
      stamp_a: int64(message.stampA, [1, message.stampA.length]),
      len_a: int64([message.locA.length], [1]),
      loc_b: int64(message.locB, [1, message.locB.length]),
      tim_b: int64(message.timeB, [1, message.timeB.length]),
      stamp_b: int64(message.stampB, [1, message.stampB.length]),
      len_b: int64([message.locB.length], [1]),
      mask_ratio: new ort.Tensor("float32", Float32Array.from([message.maskRatio]), [1]),
    });
    const runMs = performance.now() - runStarted;
    const score = result.score.data as Float32Array;
    const attnAB = result.attention_a_to_b;
    const attnBA = result.attention_b_to_a;
    const maskA = result.mask_a.data as Float32Array;
    const maskB = result.mask_b.data as Float32Array;
    self.postMessage({
      type: "result",
      id: message.id,
      score: score[0],
      attentionAB: { data: attnAB.data, dims: attnAB.dims },
      attentionBA: { data: attnBA.data, dims: attnBA.dims },
      maskA: Array.from(maskA),
      maskB: Array.from(maskB),
      timing: { loadMs, runMs },
    });
  } catch (error) {
    self.postMessage({ type: "error", id: message.id, message: error instanceof Error ? error.message : String(error) });
  }
};
