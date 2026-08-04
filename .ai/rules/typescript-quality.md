# TypeScript Quality Rules

## Purpose

Ensure all generated TypeScript code is:

* Type-safe
* ESLint compliant
* Maintainable
* Free from unnecessary type issues
* Compatible with project TypeScript configuration

Generated code MUST pass:

* TypeScript compiler
* ESLint checks
* Existing project lint rules

---

# 1. No TypeScript Errors

Generated code MUST NOT introduce:

* Type errors
* Missing properties
* Incorrect imports
* Invalid function arguments
* Unsafe type assumptions

Before finishing code generation, verify:

* All types are correct.
* All imports exist.
* All functions match their signatures.
* No TypeScript compiler errors are introduced.

---

# 2. Avoid Using `any`

`any` is forbidden unless there is a strong technical reason.

Bad:

```ts
function process(data: any) {
  return data.value;
}
```

Do NOT introduce `any` to:

* Fix TypeScript errors
* Fix ESLint errors
* Bypass type checking
* Avoid defining a proper type
* Handle unknown external data

Prefer explicit types:

```ts
interface ProcessData {
  value: string;
}

function process(data: ProcessData) {
  return data.value;
}
```

When the type is genuinely unknown, prefer `unknown`:

```ts
function process(data: unknown) {
  // Validate or narrow the type before accessing properties.
}
```

---

# 3. No Unsafe TypeScript Operations

Generated code MUST NOT introduce unsafe TypeScript operations.

Pay particular attention to the following ESLint rules:

* `@typescript-eslint/no-unsafe-assignment`
* `@typescript-eslint/no-unsafe-argument`
* `@typescript-eslint/no-unsafe-call`
* `@typescript-eslint/no-unsafe-member-access`
* `@typescript-eslint/no-unsafe-return`

When one of these rules reports an error, fix the underlying type problem.

DO NOT suppress the error.

DO NOT disable the ESLint rule.

DO NOT convert the value to `any`.

Bad:

```ts
const data: any = getData();

const user: User = data;
```

Bad:

```ts
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const user = response.data;
```

Good:

```ts
const response = await api.get<User>('/users');

const user = response.data;
```

If the value cannot be known statically:

```ts
const data: unknown = getData();
```

Then validate or narrow the type before using it.

---

# 4. Avoid Unnecessary Type Assertions

Do NOT use type assertions merely to silence TypeScript or ESLint errors.

Bad:

```ts
const user = data as User;
```

when `data` has not been validated as `User`.

Bad:

```ts
const value = data as any;
```

Prefer fixing the source type.

Use type assertions only when the type relationship is known and justified.

---

# 5. Avoid Non-Null Assertions

Avoid the non-null assertion operator:

```ts
value!
```

Do NOT use `!` simply to silence TypeScript errors.

Bad:

```ts
const user = users.find(user => user.id === id)!;
```

Prefer explicit handling:

```ts
const user = users.find(user => user.id === id);

if (!user) {
  throw new NotFoundException('User not found');
}
```

A non-null assertion is acceptable only when the value is guaranteed to exist by a clear application invariant.

---

# 6. Type External Data

Data coming from external boundaries MUST NOT be blindly trusted.

External boundaries include:

* HTTP requests
* API responses
* `JSON.parse`
* Environment variables
* Webhooks
* Database JSON fields
* Third-party libraries
* User input
* External services

Do NOT assume external data has the expected type without validation.

Bad:

```ts
const data = JSON.parse(payload) as User;
```

Prefer:

```ts
const data: unknown = JSON.parse(payload);
```

Then validate or narrow the value before using it.

---

# 7. Do Not Disable ESLint to Fix Code

Never use ESLint suppression as the first solution.

Avoid:

```ts
// eslint-disable-next-line
```

```ts
// eslint-disable
```

```ts
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
```

Do NOT modify ESLint configuration merely to make generated code pass.

Do NOT weaken ESLint rules to avoid fixing the underlying problem.

ESLint errors MUST be fixed in the implementation whenever reasonably possible.

---

# 8. ESLint Must Pass

After implementing or modifying TypeScript code:

1. Run ESLint.
2. Review every ESLint error.
3. Fix the underlying issue.
4. Run ESLint again.
5. Repeat until ESLint passes.

Do NOT consider the task complete while ESLint errors remain.

If the project provides a dedicated lint command, use that command instead of inventing a new one.

---

# 9. TypeScript Type Checking

After implementing or modifying TypeScript code:

1. Run the project's type-check command if available.
2. Fix all TypeScript errors.
3. Run the type-check command again.
4. Do not consider the task complete while type errors remain.

Do NOT weaken:

* `tsconfig.json`
* `strict`
* ESLint rules
* TypeScript compiler settings

just to make the implementation pass.

---

# 10. Fix the Root Cause

When TypeScript or ESLint reports an error:

> Fix the root cause instead of bypassing the error.

The following approaches are NOT acceptable:

```ts
as any
```

```ts
: any
```

```ts
!
```

```ts
// eslint-disable-next-line
```

Changing ESLint configuration

Changing TypeScript configuration

unless explicitly required and justified by the project.

The preferred order is:

1. Fix the source type.
2. Add or improve the type definition.
3. Narrow `unknown` safely.
4. Validate external data.
5. Refactor the implementation if necessary.
6. Use a type assertion only when the type relationship is genuinely guaranteed.
7. Use `any` only as a last resort with a clear technical justification.

---

# 11. Definition of Done

A TypeScript implementation is NOT complete until:

* TypeScript compilation/type checking passes.
* ESLint passes.
* No new `any` is introduced without justification.
* No unsafe TypeScript operations remain.
* No unnecessary type assertions remain.
* No unnecessary non-null assertions remain.
* No ESLint rules are disabled to hide errors.
* No TypeScript compiler settings are weakened to hide errors.