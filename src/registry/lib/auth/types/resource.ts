export type BaseResource<T extends string> = {
	type: T;
	[key: string]: unknown;
};
export type BaseResourceMap<
	T extends { [K in keyof T]: BaseResource<K & string> },
> = T;
export type WithType<K extends string, T> = T & { type: K };
