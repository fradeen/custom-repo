import type { OperatorFor } from "@/registry/lib/auth/types/operator";
import type { AuthContext } from "@/registry/lib/auth/types/policy";
import type { BaseResource } from "@/registry/lib/auth/types/resource";
import type { BaseSubject } from "@/registry/lib/auth/types/subject";

type Primitive = string | boolean | number | bigint;
type Fact = "context";

type DotPathMap<T, Prefix extends string = ""> = {
	[K in keyof T & string]: T[K] extends Primitive
		? { path: `${Prefix}${K}`; type: T[K] }
		: T[K] extends Date
			? { path: `${Prefix}${K}`; type: Date }
			: T[K] extends Array<infer U>
				? { path: `${Prefix}${K}`; type: Array<U> }
				: T[K] extends Record<infer _k, unknown>
					? DotPathMap<T[K], `${Prefix}${K}.`>
					: never;
}[keyof T & string];

type PathRegistry<
	S extends BaseSubject,
	Resource extends BaseResource<string>,
	RequiresResource extends boolean,
> = DotPathMap<AuthContext<S, Resource, RequiresResource>>;

export type ConditionNode<
	S extends BaseSubject,
	Resource extends BaseResource<string>,
	RequiresResource extends boolean,
> = PathRegistry<S, Resource, RequiresResource> extends infer P extends {
	path: string;
	type: Primitive | Date | Array<infer _U>;
}
	? {
			[K in P as K["path"]]: {
				fact: Fact;
				path: `$.${K["path"]}`;
				operator: OperatorFor<K["type"]>;
				value:
					| K["type"]
					| {
							fact: Fact;
							path: `$.${Exclude<Extract<P, { type: K["type"] }>["path"], K["path"]>}`;
					  };
			};
		}[P["path"]]
	: never;

export type Condition<
	S extends BaseSubject,
	Resource extends BaseResource<string>,
	RequiresResource extends boolean,
> =
	| {
			kind: "all";
			all: (
				| ConditionNode<S, Resource, RequiresResource>
				| Condition<S, Resource, RequiresResource>
			)[];
	  }
	| {
			kind: "any";
			any: (
				| ConditionNode<S, Resource, RequiresResource>
				| Condition<S, Resource, RequiresResource>
			)[];
	  };

// type Resource1 = { type: "abc"; extra: number };
// type Resource2 = { type: "cde" };
// type ResourceMap = BaseResourceMap<{
// 	abc: Resource1;
// 	cde: Resource2;
// }>;
// type Resource = ResourceMap[keyof ResourceMap];
// type User = { id: number };
// const ACTIONS = ["create", "read"] as const;
// type Action = (typeof ACTIONS)[number];

// const conditionNode: ConditionNode<User, ResourceMap["abc"], true> = {
// 	fact: "context",
// 	operator: "in",
// 	path: "$.subject.id",
// 	value: {
// 		fact: "context",
// 		path: "$.resource.extra",
// 	},
// };

// const condition: Condition<User, ResourceMap["abc"], true> = {
// 	kind: "any",
// 	any: [
// 		conditionNode,
// 		{
// 			fact: "context",
// 			operator: "equal",
// 			path: "$.subject.id",
// 			value: 1234,
// 		},
// 		{
// 			kind: "all",
// 			all: [conditionNode, conditionNode],
// 		},
// 	],
// };
