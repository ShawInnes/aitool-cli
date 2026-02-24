import {z} from 'zod';

export const ModelEntrySchema = z.object({
  litellm_provider: z.string().optional(),
  mode: z.enum([
    "audio_speech",
    "audio_transcription",
    "chat",
    "completion",
    "embedding",
    "image_edit",
    "image_generation",
    "moderation",
    "ocr",
    "rerank",
    "responses",
    "search",
    "vector_store",
    "video_generation"
  ]).optional(),

  // Token limits
  max_tokens: z.number().optional(),
  max_input_tokens: z.number().optional(),
  max_output_tokens: z.number().optional(),

  // Token costs
  input_cost_per_token: z.number().optional(),
  output_cost_per_token: z.number().optional(),
  output_cost_per_reasoning_token: z.number().optional(),
  input_cost_per_audio_token: z.number().optional(),

  // Tool / computer-use costs
  computer_use_input_cost_per_1k_tokens: z.number().optional(),
  computer_use_output_cost_per_1k_tokens: z.number().optional(),
  code_interpreter_cost_per_session: z.number().optional(),

  // File / vector store costs
  file_search_cost_per_1k_calls: z.number().optional(),
  file_search_cost_per_gb_per_day: z.number().optional(),
  vector_store_cost_per_gb_per_day: z.number().optional(),

  // Search
  search_context_cost_per_query: z.object({
    search_context_size_low: z.number(),
    search_context_size_medium: z.number(),
    search_context_size_high: z.number(),
  }).optional(),

  // Capability flags
  supports_vision: z.boolean().optional(),
  supports_function_calling: z.boolean().optional(),
  supports_parallel_function_calling: z.boolean().optional(),
  supports_response_schema: z.boolean().optional(),
  supports_system_messages: z.boolean().optional(),
  supports_prompt_caching: z.boolean().optional(),
  supports_reasoning: z.boolean().optional(),
  supports_audio_input: z.boolean().optional(),
  supports_audio_output: z.boolean().optional(),
  supports_web_search: z.boolean().optional(),

  // Metadata
  deprecation_date: z.string().optional(),
  supported_regions: z.array(z.string()).optional(),
}).passthrough(); // tolerate undocumented fields added by LiteLLM over time

export type ModelEntry = z.infer<typeof ModelEntrySchema>;

export const ModelPricesSchema = z.record(z.string(), ModelEntrySchema);

export type ModelPrices = z.infer<typeof ModelPricesSchema>;
