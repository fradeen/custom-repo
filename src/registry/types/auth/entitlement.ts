import type { Policy } from "@/registry/types/auth/policy";
import type { BaseResource } from "@/registry/types/auth/resource";
import type { BaseSubject } from "@/registry/types/auth/subject";

export type Entitlement<
	S extends BaseSubject,
	Resource extends BaseResource<string>,
	Actions extends string[],
> = {
	id: number;
	title: string;
	description: string;
	resource: Resource["type"];
	policies: {
		[A in Actions[number]]?:
			| Policy<S, Resource, true>
			| Policy<S, Resource, false>;
	};
};
