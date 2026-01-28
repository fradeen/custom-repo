# Custom shadcn registry for Attribute Based Access Control (ABAC) system

This repository is a shadcn "custom registry" that ships a small, strongly-typed ABAC helper and types. When added via the shadcn CLI the files under `src/registry/lib/auth/*` are copied into the target project to provide a ready-to-use, serializable access-control system.

## Installation

Add "Access Controll" lib from this registry via the shadcn CLI 
```sh
npx shadcn@latest add https://registry.frad-fardeen.workers.dev/r/access-control.json
```

## Primary files:
- `src/registry/lib/auth/abac.ts` — AccessControl implementation.
- `src/registry/lib/auth/types/*` — Base types (subject, resource, condition, operator, policy, entitlements).

## Basic Usage Example:

```ts
import { AccessControl } from "@/registry/lib/auth/abac";
import type { Condition } from "@/registry/lib/auth/types/condition";
import type { BaseResourceMap } from "@/registry/lib/auth/types/resource";

/*
Declare types of resources in the system.
It is essential that each resource type has a key "type" which is of type string.
use "WithType" helper type to add type key to existing type eg:
type Resource = {attr: atring}
type ResourceWithType = WithType<"resource",Resource>
*/
export type Resource1 = { type: "resource1"; attr1: string };
export type Resource2 = { type: "resource2"; attr1: number };
/*
Create resource map; mapping each resource type to string key with same literal key as type property of the resource.
BaseResourceMap helper type ensures the criteria described above.
*/
export type ResourceMap = BaseResourceMap<{
	resource1: Resource1;
	resource2: Resource2;
}>;
// Declare actions and associated types; actions list must be readonly
export const ACTIONS = ["read", "edit"] as const;
export type Actions = typeof ACTIONS;
export type Action = Actions[number];
//Declare subject type which just needs to be Record<string,unknown>; i.e basic object
export type User = { id: number; name: string };
/*
Create new instance of AccessControl class by passing three generics: 

1. Subject type: 
2. Actions: type of actions list passed as part of config object passed to constructor
3. ResourceMap: 

Constructor args: 
object with two properties: 

1. actions: read only list of actions applicable to resources in the resource map 
2. getConditions: an async method that takes subject, resource,action, requiresResorce args and returns
a list of conditions of type Condition<Subject, Resource, boolean>
 */
const accessControl = new AccessControl<User, Actions, ResourceMap>({
	actions: ACTIONS,
	async getConditions(subject, resource, action, RequiresResource) {
		const condition: Condition<User, Resource1, true> = {
			kind: "all",
			all: [
				{
					fact: "context",
					operator: "equal",
					path: "$.subject.id",
					value: 123,
				},
				{
					fact: "context",
					operator: "equal",
					path: "$.subject.name",
					value: {
						fact: "context",
						path: "$.resource.attr1",
					},
				},
			],
		};
		return [condition] as Condition<User, Resource1, boolean>[];
	},
});

console.log(
	await accessControl
		.can({ id: 123, name: "user" })
		.read({ type: "resource1", attr1: "user" }),
);
// logs : true

```

## Core concepts and types

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
