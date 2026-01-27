# custom-registry — shadcn registry: Attribute Based Access Control (ABAC)

This repository is a shadcn "custom registry" that ships a small, strongly-typed ABAC helper and types. When added via the shadcn CLI the files under `src/registry/lib/auth/*` are copied into the target project to provide a ready-to-use, serializable access-control surface.

Primary files:
- `src/registry/lib/auth/abac.ts` — AccessControl implementation.
- `src/registry/lib/auth/types/*` — Base types (subject, resource, condition, operator, policy, entitlements).

Goals
- Provide a minimal, well-typed ABAC runtime that:
  - Uses a pluggable async `getConditions` callback to fetch rules.
  - Evaluates condition objects with `json-rules-engine`.
  - Short-circuits on the first successful condition.
  - Makes condition objects fully serializable (JSON) so they can be stored in DBs / KV stores / files.
  - Offers great DX via TypeScript generics for subjects, resources and actions.

Core concepts and types
- BaseSubject
  - A lightweight constraint on subject objects passed to checks (your user/principal shape).
  - Use a plain object type that contains the identity or attributes you want to test (e.g. `{ id: string }`, `{ uid: string; roles?: string[] }`).

- BaseResource<T extends string>
  - Shape: `{ type: T; [key: string]: unknown }`.
  - `type` is a literal discriminant for the resource (e.g. "doc", "repo", "image").
  - Additional attributes on a resource instance are allowed and are included in evaluation context.

- BaseResourceMap<T>
  - A mapping of resource keys to their BaseResource types, e.g.:
    `{ doc: BaseResource<"doc">; other: BaseResource<"other"> }`.
  - This lets the AccessControl API be fully typed for allowed resource types.

- AccessControl<S, Actions, ResourceMap>
  - Generics:
    - S: subject type (extends BaseSubject).
    - Actions: readonly array of string literals (e.g. `readonly ["read","write"]`).
    - ResourceMap: BaseResourceMap describing available resource types.
  - Constructor config:
    - `actions: ReadonlyArray<string>`
    - `getConditions: (subject, resourceType, action, requiresResource) => Promise<Condition[]>`
      - `resourceType` is the resource type string (extracted from a resource object or provided directly).
      - `requiresResource` is true when the caller passed a resource *object* (so policies may reference `resource` fields); false when only a resource-type string was provided.

abac.ts behavior (implementation details)
- `can(subject)` returns an object with functions for each configured action (typed).
- When you call an action method:
  1. The code calls your `getConditions(subject, resourceType, action, requiresResource)`.
  2. If no conditions are returned, the library logs an error and returns `false` (deny-by-default).
  3. Evaluation loop (engine reuse):
     - AccessControl creates a single `json-rules-engine` Engine instance per check invocation (not per-condition) and adds the `"context"` fact once. For each condition the implementation:
       - Removes the previous rule (the implementation uses a fixed rule name/key) and adds the new rule object.
       - Runs the engine. If the engine emits any `events`, the check returns `true` immediately (short-circuit).
     - Reusing the same Engine instance (and removing the previous rule before adding the next) avoids re-creating engine internals and reduces overhead while keeping each condition isolated by replacing the rule keyed by the fixed name.
  4. If no condition yields an event, the check returns `false`.
  5. Any thrown error (from `getConditions` or engine evaluation) is caught, logged, and treated as a deny (`false`).

Why engine reuse matters
- Creating a new Engine for each condition is more expensive and unnecessary because rules can be swapped by removing the last rule (the implementation uses the same literal rule key/name) and adding the next one.
- Reuse preserves a single facts set (context) and keeps evaluation deterministic while reducing GC and initialization cost.

Condition serialization and storage
- Conditions are plain JSON objects compatible with `json-rules-engine`'s `conditions` field.
- Example of a small, serializable condition:
```json
{
  "kind": "all",
  "all": [
    { "fact": "context", "operator": "equal", "path": "$.subject.id", "value": "user-123" },
    { "fact": "context", "operator": "equal", "path": "$.resource.type", "value": "doc" }
  ]
}
```
- Best practices for storage:
  - Store each condition as JSON in your DB/KV (include metadata: action, resourceType, createdAt, version).
  - Keep conditions small and explicit (prefer `path`-based checks against `context.subject` and `context.resource`).
  - Version your conditions schema to allow safe migrations.

Example: wiring AccessControl to persisted policies
```ts
import { AccessControl } from "./src/lib/auth/abac";
import type { BaseResource, BaseResourceMap } from "./src/lib/auth/types/resource";

type Subject = { id: string; roles?: string[] };
type Doc = BaseResource<"doc">;
type Resources = BaseResourceMap<{ doc: Doc }>;

const ac = new AccessControl<Subject, readonly ["read","write"], Resources>({
  actions: ["read", "write"],
  getConditions: async (subject, resourceType, action, requiresResource) => {
    // Example: load serialized conditions from DB by (resourceType, action)
    // Parse/validate JSON into the Condition shape expected by json-rules-engine
    const rows = await db.query("SELECT condition_json FROM policies WHERE resource_type=? AND action=? AND department=?", [resourceType, action,subject.department]);
    return rows.map(r => JSON.parse(r.condition_json));
  }
});

// Use:
await ac.can({ id: "u1" }).read({ type: "doc", ownerId: "u1" }); // resource object -> requiresResource=true
await ac.can({ id: "u1" }).read("doc"); // resource-type only -> requiresResource=false
```

Design & DX recommendations
- Keep rules serializable and engine-agnostic:
  - Use `fact: "context"` and `path` expressions against `context.subject` / `context.resource`. This keeps rules portable and easy to store.
- Cache conditions where appropriate:
  - `getConditions` can implement caching (in-memory or Redis) keyed by (subject attributes, resourceType, action) to reduce DB load.
- Fail-closed:
  - The library treats missing/errored condition loads as deny — implement monitoring/alerts when `console.error` logs appear.
- Testability:
  - Tests should mock `json-rules-engine` (done in `test/access-control.spec.ts`) so unit tests validate only the AccessControl wiring and not the third-party engine.

Testing notes
- The included test suite mocks `json-rules-engine` to assert:
  - `getConditions` parameters and `requiresResource` behavior.
  - The short-circuiting behavior (engine run count).
  - Error handling (no conditions, thrown errors).
- Run tests with Vitest:
```bash
npm run test
npm run coverage
```

How this registry is intended to be used with shadcn CLI
- Add this registry via the shadcn CLI (e.g. `shadcn registry add <name>` — see shadcn docs).
- The registry will copy `src/registry/lib/auth/*` into your project; you can then adapt `getConditions` to your storage/backend and extend types to suit your domain.

Summary
- This registry gives you a small, serializable ABAC runtime with strong TypeScript DX.
- Store condition objects as JSON, implement `getConditions` to load/transform those JSON conditions, and rely on the AccessControl wiring to evaluate policies deterministically and safely (deny-on-error).