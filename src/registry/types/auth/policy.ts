import type { ConditionTree } from "@/registry/types/auth/condition-tree";
import type { BaseResource } from "@/registry/types/auth/resource";
import type { BaseSubject } from "@/registry/types/auth/subject";

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
