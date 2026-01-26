import { evaluateConditionTree } from "@/registry/lib/auth/condition-tree-eval";
import type { ConditionTree } from "@/registry/lib/auth/types/condition-tree";
import type { BaseResource } from "@/registry/lib/auth/types/resource";
import type { BaseSubject } from "@/registry/lib/auth/types/subject";

type AccessControlConfig<
	S extends BaseSubject,
	Actions extends Readonly<Array<string>>,
	ResourceMap extends { [K in keyof ResourceMap]: BaseResource<K & string> },
> = {
	actions: Readonly<Array<string>>;
	getConditions: (
		subject: S,
		resource: ResourceMap[keyof ResourceMap]["type"],
		action: Actions[number],
		RequiresResource: boolean,
	) => Promise<ConditionTree<S, ResourceMap[keyof ResourceMap], boolean>[]>;
};
type ActionMethodMap<
	Actions extends Readonly<Array<string>>,
	ResourceMap extends { [K in keyof ResourceMap]: BaseResource<K & string> },
> = {
	[A in Actions[number]]: (
		arg:
			| ResourceMap[keyof ResourceMap]
			| ResourceMap[keyof ResourceMap]["type"],
	) => Promise<boolean>;
};
export class AccessControl<
	S extends BaseSubject,
	Actions extends Readonly<Array<string>>,
	ResourceMap extends { [K in keyof ResourceMap]: BaseResource<K & string> },
> {
	#config: AccessControlConfig<S, Actions, ResourceMap>;
	async #checkAccess(
		subject: S,
		action: Actions[number],
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
		[A in Actions[number]]: (
			arg:
				| ResourceMap[keyof ResourceMap]
				| ResourceMap[keyof ResourceMap]["type"],
		) => Promise<boolean>;
	} {
		const api: ActionMethodMap<Actions, ResourceMap> = {} as ActionMethodMap<
			Actions,
			ResourceMap
		>;

		for (const action of this.#config.actions) {
			api[action as Actions[number]] = (arg) =>
				this.#checkAccess(subject, action, arg);
		}
		return Object.freeze(api);
	}
}
