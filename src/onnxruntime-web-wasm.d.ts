// The upstream ONNX Runtime Web 1.21.0 "wasm" subpath has no exported
// TypeScript declaration when imported through Vite's bundler resolution.
// Declare only the API surface used by JOMON PIX. The integration test runs
// the actual packaged JS/WASM and model to verify runtime compatibility.
declare module 'onnxruntime-web/wasm' {
  export const env: {
    wasm: {
      numThreads: number;
      proxy: boolean;
      wasmPaths: string;
    };
  };
  export class Tensor {
    constructor(type: 'uint8', data: Uint8Array, dims: number[]);
    readonly type: string;
    readonly dims: readonly number[];
    readonly data: Uint8Array;
  }
  export class InferenceSession {
    static create(
      model: ArrayBuffer,
      options: { executionProviders: ('wasm')[]; graphOptimizationLevel: 'basic' },
    ): Promise<InferenceSession>;
    run(
      feeds: { image: Tensor; mask: Tensor },
    ): Promise<Record<string, Tensor>>;
    release(): Promise<void>;
  }
}
