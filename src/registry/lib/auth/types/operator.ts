type StringOperators =
	| "equal"
	| "notEqual"
	| "contains"
	| "doesNotContain"
	| "startsWith"
	| "endsWith";

type NumberOperators =
	| "equal"
	| "notEqual"
	| "greaterThan"
	| "greaterThanInclusive"
	| "lessThan"
	| "lessThanInclusive";

type BooleanOperators = "equal" | "notEqual";

type DateOperators =
	| "equal"
	| "notEqual"
	| "greaterThan"
	| "greaterThanInclusive"
	| "lessThan"
	| "lessThanInclusive"
	| "before"
	| "after";

type ArrayOperators =
	| "equal"
	| "notEqual"
	| "lengthEqual"
	| "lengthNotEqual"
	| "lengthGreaterThan"
	| "lengthLessThan";

export type OperatorFor<T> = T extends string
	? StringOperators
	: T extends number
		? NumberOperators
		: T extends bigint
			? NumberOperators
			: T extends boolean
				? BooleanOperators
				: T extends Date
					? DateOperators
					: T extends Array<unknown>
						? ArrayOperators
						: never;
