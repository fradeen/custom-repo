export const OPERATORS = ["eq", "neq", "gt", "lt", "gte", "lte"] as const;
export type Operator = (typeof OPERATORS)[number];
