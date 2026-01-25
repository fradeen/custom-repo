import { AccessControl, type UnionOf } from "@/registry/lib/auth/abac";
import { ConditionTree } from "@/registry/lib/auth/types/condition-tree";
import { BaseResourceMap } from "@/registry/lib/auth/types/resource";

type ResourceMap = BaseResourceMap<{
	abc: { type: "abc"; extra: number };
	cde: { type: "cde" };
}>;
type User = { id: number };
const actions = new Set(["create", "read"] as const);
type Action = UnionOf<typeof actions>;
const getConditions = async (
	subject: User,
	resource: ResourceMap[keyof ResourceMap]["type"],
	action: Action,
	RequiresResource: boolean,
): Promise<ConditionTree<User, ResourceMap[keyof ResourceMap], boolean>[]> => {
	const conditionTree: ConditionTree<User, ResourceMap["abc"], true> = {
		op: "eq",
		left: "subject.id",
		right: "resource.extra",
	};
	return [conditionTree] as ConditionTree<
		User,
		ResourceMap[keyof ResourceMap],
		boolean
	>[];
};
export const accessControl = new AccessControl<
	User,
	typeof actions,
	ResourceMap
>({
	actions,
	getConditions,
});
