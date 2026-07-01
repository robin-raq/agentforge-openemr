import { tool, type DynamicStructuredTool } from "@langchain/core/tools";
import type { z } from "zod";

/**
 * Thin wrapper around LangChain's `tool()` that erases its deep return-type
 * generic at a single, documented boundary.
 *
 * Why this exists: `@langchain/core` + `zod@3.25` trip TypeScript's TS2589
 * ("Type instantiation is excessively deep and possibly infinite") on every
 * `tool()` call. That unbounded instantiation is also what made `tsc --noEmit`
 * consume ~11 GB and take ~13 min (≈9.8M types). Casting `tool` to a simple
 * signature stops the compiler from resolving the deep inferred type.
 *
 * This is a workaround for a compiler/library limitation, not a way to skip
 * type checking: `config` (name/description/schema) is still fully type-checked
 * here, and Zod validates the tool input at runtime. Only the tool's *input*
 * type inside `fn` is widened to `any` (the deep generic that TS cannot
 * instantiate). Runtime behaviour is identical to calling `tool()` directly.
 */
export function defineTool(
  fn: (input: any) => Promise<string>,
  config: { name: string; description: string; schema: z.ZodTypeAny },
): DynamicStructuredTool {
  const build = tool as unknown as (
    f: typeof fn,
    c: typeof config,
  ) => DynamicStructuredTool;
  return build(fn, config);
}
