import type { BaseResource } from "@/registry/types/auth/resource";
import type { BaseSubject } from "@/registry/types/auth/subject";

export class ResourceManager<
	ResourceMap extends { [K in keyof ResourceMap]: BaseResource<K & string> },
	S extends BaseSubject,
> {
	#actions: Readonly<Set<string>>;
	constructor(actions: Readonly<Set<string>>) {
		this.#actions = actions;
	}

	// Example method: only accepts allowed resources
	handle<K extends keyof ResourceMap>(resource: ResourceMap[K]) {
		console.log("Handling:", resource);
	}
}
