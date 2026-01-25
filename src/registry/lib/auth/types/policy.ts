import type { ConditionTree } from "@/registry/lib/auth/types/condition-tree";
import type { BaseResource } from "@/registry/lib/auth/types/resource";
import type { BaseSubject } from "@/registry/lib/auth/types/subject";

export type AuthContext<
	S extends BaseSubject,
	Resource extends BaseResource<string>,
	RequiresResource extends boolean,
> = RequiresResource extends true
	? { subject: S; resource: Resource }
	: { subject: S };

export type Policy<
	S extends BaseSubject,
	Resource extends BaseResource<string>,
	RequiresResource extends boolean,
> = {
	requiresResource: RequiresResource;
	conditions: ConditionTree<S, Resource, RequiresResource>;
};
