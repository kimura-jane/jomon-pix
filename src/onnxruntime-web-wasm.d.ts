// ONNX Runtime 1.21.0 ships a browser WASM-only entrypoint but does not
// expose its own package TypeScript declarations for that subpath.
// The WASM entrypoint implements the same public API as the root module.
declare module 'onnxruntime-web/wasm' {
  export * from 'onnxruntime-web';
}
