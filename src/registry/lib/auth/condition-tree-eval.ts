import type { ConditionTree } from "@/registry/lib/auth/types/condition-tree";
import type { AuthContext } from "@/registry/lib/auth/types/policy";
import type { BaseResource } from "@/registry/lib/auth/types/resource";
import type { BaseSubject } from "@/registry/lib/auth/types/subject";

function getValueByPath<
	S extends BaseSubject,
	Resource extends BaseResource<string>,
	RequiresResource extends boolean,
>(ctx: AuthContext<S, Resource, RequiresResource>, path: string): unknown {
	return path.split(".").reduce<unknown>((acc, key) => {
		if (acc && typeof acc === "object" && !Array.isArray(acc)) {
			return (acc as Record<string, unknown>)[key];
		}
		return undefined;
	}, ctx);
}

function coerceTypes(
	l: unknown,
	r: unknown,
): [number, number] | [boolean, boolean] | [string, string] {
	if (!Number.isNaN(Number(l)) && !Number.isNaN(Number(r)))
		return [Number(l), Number(r)];
	if (typeof l === "boolean" || typeof r === "boolean")
		return [Boolean(l), Boolean(r)];
	return [l, r] as [string, string];
}

export function evaluateConditionTree<
	S extends BaseSubject,
	Resource extends BaseResource<string>,
	RequiresResource extends boolean,
>(
	tree: ConditionTree<S, Resource, RequiresResource>,
	ctx: AuthContext<S, Resource, RequiresResource>,
): boolean {
	// Group node
	if ("join" in tree) {
		return tree.join === "and"
			? tree.conditions.every((c) => evaluateConditionTree(c, ctx))
			: tree.conditions.some((c) => evaluateConditionTree(c, ctx));
	}

	// Leaf node
	const lRaw = getValueByPath(ctx, tree.left);

	const rRaw =
		typeof tree.right === "string" &&
		(tree.right.startsWith("subject.") ||
			(tree.right.startsWith("resource.") && "resource" in ctx))
			? getValueByPath(ctx, tree.right)
			: tree.right;

	const [l, r] = coerceTypes(lRaw, rRaw);

	switch (tree.op) {
		case "eq":
			return l === r;
		case "neq":
			return l !== r;
		case "gt":
			return (l as number) > (r as number);
		case "lt":
			return (l as number) < (r as number);
		case "gte":
			return (l as number) >= (r as number);
		case "lte":
			return (l as number) <= (r as number);
		default:
			return false;
	}
}
