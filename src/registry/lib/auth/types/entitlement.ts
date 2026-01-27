import type { Policy } from "@/registry/lib/auth/types/policy";
import type { BaseResource } from "@/registry/lib/auth/types/resource";
import type { BaseSubject } from "@/registry/lib/auth/types/subject";

export type Entitlement<
	S extends BaseSubject,
	Resource extends BaseResource<string>,
	Actions extends Readonly<string[]>,
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
