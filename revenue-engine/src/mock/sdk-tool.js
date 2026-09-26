// betaTool from @anthropic-ai/sdk, for the preview's in-browser station. The mock only ever replays scripted runs, so
// a tool is just its name, schema and run function; no model is ever called from the preview.
export function betaTool(options) {
  if (options.inputSchema.type !== 'object') throw new Error(`JSON schema for tool "${options.name}" must be an object`);
  return { type: 'custom', name: options.name, input_schema: options.inputSchema, description: options.description, run: options.run, parse: (c) => c };
}
