# TypeScript Quality Rules

## Purpose

Ensure all generated TypeScript code is:

- Type-safe
- ESLint compliant
- Maintainable
- Free from unnecessary type issues
- Compatible with project TypeScript configuration

Generated code MUST pass:

- TypeScript compiler
- ESLint checks
- Existing project lint rules

---

# 1. No TypeScript Errors

Generated code MUST NOT introduce:

- Type errors
- Missing properties
- Incorrect imports
- Invalid function arguments
- Unsafe type assumptions

Before finishing code generation, verify:

- All types are correct.
- All imports exist.
- All functions match their signatures.

---

# 2. Avoid Using `any`

`any` is forbidden unless there is a strong technical reason.

Bad:

```ts
function process(data: any) {
  return data.value;
}