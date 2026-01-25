import { evaluateConditionTree } from "@/registry/lib/auth/condition-tree";
import type { ConditionTree } from "@/registry/lib/auth/types/condition-tree";
import type { BaseResource } from "@/registry/lib/auth/types/resource";
import type { BaseSubject } from "@/registry/lib/auth/types/subject";

type AccessControlConfig<
	S extends BaseSubject,
	Actions extends Readonly<Set<string>>,
	ResourceMap extends { [K in keyof ResourceMap]: BaseResource<K & string> },
> = {
	actions: Readonly<Set<string>>;
	getConditions: (
		subject: S,
		resource: ResourceMap[keyof ResourceMap]["type"],
		action: UnionOf<Actions>,
		RequiresResource: boolean,
	) => Promise<ConditionTree<S, ResourceMap[keyof ResourceMap], boolean>[]>;
};
export type UnionOf<S> = S extends Set<infer T> ? T : never;
type ActionMethodMap<
	Actions extends Readonly<Set<string>>,
	ResourceMap extends { [K in keyof ResourceMap]: BaseResource<K & string> },
> = {
	[A in UnionOf<Actions>]: (
		arg:
			| ResourceMap[keyof ResourceMap]
			| ResourceMap[keyof ResourceMap]["type"],
	) => Promise<boolean>;
};
export class AccessControl<
	S extends BaseSubject,
	Actions extends Readonly<Set<string>>,
	ResourceMap extends { [K in keyof ResourceMap]: BaseResource<K & string> },
> {
	#config: AccessControlConfig<S, Actions, ResourceMap>;
	async #checkAccess(
		subject: S,
		action: UnionOf<Actions>,
		resource:
			| ResourceMap[keyof ResourceMap]
			| ResourceMap[keyof ResourceMap]["type"],
	): Promise<boolean> {
		const resourceType =
			typeof resource === "string" ? resource : resource.type;
		const conditions = await this.#config.getConditions(
			subject,
			resourceType,
			action,
			!(typeof resource === "string"),
		);
		console.info("conditions for authorization:", conditions);
		if (!conditions.length)
			console.error("No conditions/policies found for role-resource combo.");
		return conditions.some((condition) => {
			if (typeof resource === "string")
				return evaluateConditionTree(condition, { subject: subject });
			else
				return evaluateConditionTree(condition, {
					subject: subject,
					resource: resource,
				});
		});
	}
	constructor(config: AccessControlConfig<S, Actions, ResourceMap>) {
		this.#config = config;
	}

	can(subject: S): {
		[A in UnionOf<Actions>]: (
			arg:
				| ResourceMap[keyof ResourceMap]
				| ResourceMap[keyof ResourceMap]["type"],
		) => Promise<boolean>;
	} {
		const api: ActionMethodMap<Actions, ResourceMap> = {} as ActionMethodMap<
			Actions,
			ResourceMap
		>;

		for (const action of this.#config.actions as Readonly<
			Set<UnionOf<Actions>>
		>) {
			api[action] = (arg) => this.#checkAccess(subject, action, arg);
		}
		return Object.freeze(api);
	}
}

// export function createAccessControl<
// 	S extends BaseSubject,
// 	ResourceMap extends { [K in keyof ResourceMap]: BaseResource<K & string> },
// 	Actions extends Readonly<Set<string>>,
// >(
// 	actions: Actions,
// 	getConditions: (
// 		subject: S,
// 		resource: ResourceMap[keyof ResourceMap]["type"],
// 		action: UnionOf<Actions>,
// 		RequiresResource: boolean,
// 	) => Promise<ConditionTree<S, ResourceMap[keyof ResourceMap], boolean>[]>,
// ) {
// 	return new AccessControl<S, Actions, ResourceMap>({ actions, getConditions });
// }
