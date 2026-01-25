import type { Operator } from "@/registry/lib/auth/constant";
import type { AuthContext } from "@/registry/lib/auth/types/policy";
import type { BaseResource } from "@/registry/lib/auth/types/resource";
import type { BaseSubject } from "@/registry/lib/auth/types/subject";

type Primitive = string | boolean | number | bigint | symbol;

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

export type ValidConditionNode<
	S extends BaseSubject,
	Resource extends BaseResource<string>,
	RequiresResource extends boolean,
> = PathRegistry<S, Resource, RequiresResource> extends infer P extends {
	path: string;
	type: Primitive | Date | Array<infer _U>;
}
	? {
			[K in P as K["path"]]: {
				left: K["path"];
				op: Operator;
				right:
					| K["type"]
					| Exclude<Extract<P, { type: K["type"] }>["path"], K["path"]>;
			};
		}[P["path"]]
	: never;

export interface GroupNode<
	S extends BaseSubject,
	Resource extends BaseResource<string>,
	RequiresResource extends boolean,
> {
	join: "and" | "or";
	conditions: ConditionTree<S, Resource, RequiresResource>[];
}

export type ConditionTree<
	S extends BaseSubject,
	Resource extends BaseResource<string>,
	RequiresResource extends boolean,
> =
	| ValidConditionNode<S, Resource, RequiresResource>
	| GroupNode<S, Resource, RequiresResource>;
