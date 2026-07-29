# Code Style & Readability Rules

## Purpose

The purpose of this rule is to ensure all generated code is:

- Readable
- Maintainable
- Consistent
- Easy to understand
- Easy to extend

Generated code MUST follow these rules unless there is a strong technical reason not to.

---

# 1. General Coding Principles

Always prioritize:

```text
Readable code > Short code
Explicit code > Clever code
Simple solution > Complex abstraction
Maintainability > Quick implementation
```

The code should be understandable by another developer without requiring additional explanation.

---

# 2. Naming Convention

## General Rules

Use meaningful and intention-revealing names.

Avoid:
- Single character names
- Unclear abbreviations
- Generic names

**Bad:**
```ts
const d = new Date();
const data = getUser();
const result = process();
```

**Good:**
```ts
const currentDate = new Date();
const userProfile = getUser();
const paymentResult = processPayment();
```

## Variable Naming

Variables should represent data clearly.

**Bad:**
```ts
const x = users.length;
const temp = calculatePrice();
```

**Good:**
```ts
const totalUserCount = users.length;
const finalPrice = calculatePrice();
```

## Function Naming

Functions should describe an action.

Use verbs:

**Good:**
```ts
createUser()
validatePayment()
calculateInvoiceTotal()
sendNotification()
```

**Avoid:**
```ts
user()
payment()
data()
```

## Boolean Naming

Boolean variables/functions should start with:
- `is`
- `has`
- `can`
- `should`
- `allow`

**Good:**
```ts
const isActive = true;
const hasPermission = true;
const canRetryPayment = false;
```

---

# 3. Avoid Excessive If-Else

Avoid deeply nested conditions.

Maximum recommended nesting level: `<= 2 levels`

## Prefer Early Return

**Bad:**
```ts
function processPayment(payment) {
  if (payment) {
    if (payment.status === "SUCCESS") {
      process();
    }
  }
}
```

**Good:**
```ts
function processPayment(payment) {
  if (!payment) {
    return;
  }

  if (!isSuccessfulPayment(payment)) {
    return;
  }

  process();
}
```

## Avoid Unnecessary Else

**Bad:**
```ts
function isValid(user) {
  if (user) {
    return true;
  } else {
    return false;
  }
}
```

**Good:**
```ts
function isValid(user) {
  return Boolean(user);
}
```

## Replace Complex Conditional Logic

**Avoid:**
```ts
if (role === "ADMIN") {

} else if (role === "MANAGER") {

} else if (role === "USER") {

}
```

**Prefer:**
- Strategy Pattern
- Map lookup
- Polymorphism
- Factory Pattern

**Example:**
```ts
const roleHandlers = {
  ADMIN: adminHandler,
  MANAGER: managerHandler,
  USER: userHandler,
};

roleHandlers[role]();
```

---

# 4. Avoid Magic String and Magic Number

Never use hard-coded values inside business logic.

**Bad:**
```ts
if (subscription.status === "ACTIVE") {

}

if (retryCount >= 3) {

}
```

**Good:**
```ts
const ACTIVE_SUBSCRIPTION_STATUS = "ACTIVE";
const MAX_RETRY_ATTEMPTS = 3;

if (subscription.status === ACTIVE_SUBSCRIPTION_STATUS) {

}

if (retryCount >= MAX_RETRY_ATTEMPTS) {

}
```

## Use Enum For Fixed Values

**Bad:**
```ts
if (payment.status === "SUCCESS")
```

**Good:**
```ts
enum PaymentStatus {
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
}

if (payment.status === PaymentStatus.SUCCESS)
```

---

# 5. Comment Rules

Comments are not a replacement for bad code. Code should explain itself.

## Forbidden Comments

Do not explain obvious code.

**Bad:**
```ts
// Get user
const user = getUser();
```

**Bad:**
```ts
// Check if user is active
if (user.status === UserStatus.ACTIVE)
```

## Allowed Comments

Comments should explain:
- Why something exists
- Business decisions
- External limitations
- Complex algorithms

**Example:**
```ts
// Stripe requires invoice.paid confirmation
// before activating subscription to avoid inconsistent billing state.
await activateSubscription();
```

---

# 6. Source Code Language Rule

All source code content MUST use English.

**Forbidden:**
- Vietnamese variable names
- Vietnamese comments
- Vietnamese error messages
- Vietnamese logs

**Bad:**
```ts
const nguoiDung = getUser();

// Kiểm tra trạng thái thanh toán
checkPayment();

throw new Error("Không tìm thấy người dùng");
```

**Good:**
```ts
const user = getUser();

// Validate payment status
checkPayment();

throw new Error("User not found");
```

---

# 8. Formatting Rules

Code formatting must be consistent.

## Empty Lines

Do not create unnecessary empty lines.

**Bad:**
```ts
function createUser() {


  validateUser();


  saveUser();

}
```

**Good:**
```ts
function createUser() {
  validateUser();
  saveUser();
}
```

**Rules:**
- Maximum one empty line between logical blocks.
- Do not separate every statement.
- Keep related code together.
- Follow project formatter configuration.

---

# 9. Function Size

Functions should:
- Have one responsibility.
- Be easy to read.
- Avoid mixing multiple concerns.

**Avoid:**
- Functions longer than 40 lines.
- Multiple unrelated operations.
- Deep nesting.

**Bad:**
```ts
function checkout() {
  validateUser();
  calculateTax();
  createInvoice();
  sendEmail();
  updateDatabase();
  generateReport();
}
```

**Better:**
```ts
function checkout() {
  validateCheckout();
  processOrder();
  completeTransaction();
}
```

---

# 10. Avoid Nested Ternary

Nested ternary operators are forbidden.

**Bad:**
```ts
const result = a ? b ? c : d : e;
```

**Good:**
```ts
const result = calculateResult();
```

or:

```ts
if (condition) {
  return value;
}
return defaultValue;
```

---

# 11. Avoid Boolean Parameter Abuse

Avoid unclear function calls.

**Bad:**
```ts
createUser(user, true, false);
```

**Good:**
```ts
createUser({
  sendWelcomeEmail: true,
  activateAccount: false,
});
```

---

# 12. Constants

Repeated values must become constants.

**Bad:**
```ts
setTimeout(callback, 5000);
await delay(5000);
```

**Good:**
```ts
const RETRY_DELAY_MS = 5000;
setTimeout(callback, RETRY_DELAY_MS);
await delay(RETRY_DELAY_MS);
```

---

# 13. Import Organization

Keep imports clean.

**Rules:**
- Remove unused imports.
- Group imports consistently.
- Avoid unnecessary dependencies.

**Example:**
```ts
// External dependencies
import { Injectable } from "@nestjs/common";

// Internal modules
import { UserService } from "./user.service";
```

---

# 14. Code Duplication

Avoid duplicated logic.

**Before creating new logic:**
- Search existing implementation.
- Reuse existing functions.
- Extract shared utilities when necessary.

Do not copy-paste business logic.

---

# 15. Abstraction Rules

Do not create unnecessary abstractions.

**Avoid:**
- Empty wrapper classes
- Interfaces without multiple implementations
- Design patterns without a real need

**Follow:**
- Simple solution first.
- Abstract only when complexity appears.

---

# 16. AI Code Generation Checklist

Before generating code, verify:

- [ ] Names are meaningful.
- [ ] No Vietnamese in source code.
- [ ] No `any` types.
- [ ] No magic strings.
- [ ] No magic numbers.
- [ ] No unnecessary comments.
- [ ] No excessive if-else.
- [ ] No deep nesting.
- [ ] No duplicated logic.
- [ ] Formatting is consistent.
- [ ] Code follows existing project style.

---

# Final Rule

The generated code must look like code written by an experienced professional developer.

**Prefer:**
```text
Clean > Clever
Simple > Complex
Readable > Short
Explicit > Implicit
```
