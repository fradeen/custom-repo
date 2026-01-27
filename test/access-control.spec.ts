/** biome-ignore-all lint/suspicious/noExplicitAny: test file */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccessControl } from "../src/registry/lib/auth/abac";
import type {
	BaseResource,
	BaseResourceMap,
} from "../src/registry/lib/auth/types/resource";

/** expose a counter so tests can assert how many times the engine actually ran */
let engineRunCount = 0;

/** Mock json-rules-engine to inspect how abac.ts uses the Engine */
vi.mock("json-rules-engine", () => {
	return {
		Engine: class {
			facts: Record<string, any> = {};
			addFactCalls: Array<{ name: string; payload: any }> = [];
			addRuleCalls: any[] = [];
			removeRuleCalls = 0;
			lastRule: any = null;

			addFact(name: string, payload: any) {
				this.facts[name] = payload;
				this.addFactCalls.push({ name, payload });
			}
			removeRule() {
				this.removeRuleCalls++;
				this.lastRule = null;
			}
			addRule(rule: any) {
				this.lastRule = rule;
				this.addRuleCalls.push(rule);
			}
			async run() {
				engineRunCount++;
				const cond = this.lastRule?.conditions;
				if (!cond) return { events: [] };
				if (cond.throwEngineError) throw new Error("engine failure");
				// support explicit allow flag on condition for deterministic tests
				if (cond.allow) return { events: [{ type: "success" }] };
				return { events: [] };
			}
		},
	};
});

type SubjectNum = { id: number };
type SubjectStr = { uid: string };

type R = BaseResource<"r">;
type Other = BaseResource<"other">;

type ResourceMapR = BaseResourceMap<{ r: R }>;
type ResourceMapOther = BaseResourceMap<{ other: Other }>;

describe("AccessControl (abac.ts) behavior", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		engineRunCount = 0;
	});

	it("exposes frozen action methods for configured actions", () => {
		const ac = new AccessControl<SubjectNum, readonly ["read"], ResourceMapR>({
			actions: ["read"],
			getConditions: async () => [],
		});
		const api = ac.can({ id: 1 });
		expect(typeof api.read).toBe("function");
		expect(Object.isFrozen(api)).toBe(true);
	});

	it("passes subject+resource object into engine context when resource object provided", async () => {
		const getConditions = vi.fn(async () => [{ allow: true } as any]);
		const ac = new AccessControl<SubjectNum, readonly ["read"], ResourceMapR>({
			actions: ["read"],
			getConditions,
		});
		const allowed = await ac.can({ id: 9 }).read({ type: "r", meta: "x" });
		expect(allowed).toBe(true);
		expect(getConditions).toHaveBeenCalledWith({ id: 9 }, "r", "read", true);
	});

	it("passes only subject (no resource) into engine context when resource type string provided", async () => {
		const getConditions = vi.fn(async (_s, _r, _a, requiresResource) => {
			expect(requiresResource).toBe(false);
			return [{ allow: true } as any];
		});
		const ac = new AccessControl<
			SubjectStr,
			readonly ["read"],
			ResourceMapOther
		>({
			actions: ["read"],
			getConditions,
		});
		const allowed = await ac.can({ uid: "alice" }).read("other");
		expect(allowed).toBe(true);
		expect(getConditions).toHaveBeenCalled();
	});

	it("short-circuits when first condition allows", async () => {
		// first condition allows -> engine should run exactly once
		const getConditions = vi.fn(async () => {
			return [{ allow: true }, { allow: true }] as any;
		});
		const ac = new AccessControl<SubjectNum, readonly ["read"], ResourceMapR>({
			actions: ["read"],
			getConditions,
		});
		const allowed = await ac.can({ id: 7 }).read({ type: "r" });
		expect(allowed).toBe(true);
		expect(getConditions).toHaveBeenCalledTimes(1);
		expect(engineRunCount).toBe(1);
	});

	it("short-circuits when second condition allows and runs engine until success", async () => {
		// first denies, second allows -> engine should run twice (until success)
		const getConditions = vi.fn(async () => {
			return [{ allow: false }, { allow: true }] as any;
		});
		const ac = new AccessControl<SubjectNum, readonly ["read"], ResourceMapR>({
			actions: ["read"],
			getConditions,
		});
		const allowed = await ac.can({ id: 7 }).read({ type: "r" });
		expect(allowed).toBe(true);
		expect(getConditions).toHaveBeenCalledTimes(1);
		expect(engineRunCount).toBe(2);
	});

	it("does not short-circuit when no condition allows and runs engine for each condition", async () => {
		const getConditions = vi.fn(async () => {
			// none of these conditions allow -> engine should run for each
			return [{ allow: false }, { allow: false }, { allow: false }] as any;
		});
		const ac = new AccessControl<SubjectNum, readonly ["read"], ResourceMapR>({
			actions: ["read"],
			getConditions,
		});
		const allowed = await ac.can({ id: 8 }).read({ type: "r" });
		expect(allowed).toBe(false);
		expect(getConditions).toHaveBeenCalledTimes(1);
		// engine should have been invoked for all conditions
		expect(engineRunCount).toBe(3);
	});

	it("returns false when no conditions returned and logs an error", async () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const getConditions = vi.fn(async () => []);
		const ac = new AccessControl<SubjectNum, readonly ["read"], ResourceMapR>({
			actions: ["read"],
			getConditions,
		});
		const allowed = await ac.can({ id: 5 }).read({ type: "r" });
		expect(allowed).toBe(false);
		expect(getConditions).toHaveBeenCalled();
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});

	it("returns false and logs when getConditions throws", async () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const getConditions = vi.fn(() => Promise.reject(new Error("boom")));
		const ac = new AccessControl<SubjectNum, readonly ["read"], ResourceMapR>({
			actions: ["read"],
			getConditions,
		});
		const allowed = await ac.can({ id: 2 }).read({ type: "r" });
		expect(allowed).toBe(false);
		expect(getConditions).toHaveBeenCalled();
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});

	it("returns false and logs when the evaluation engine throws", async () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const getConditions = vi.fn(async () => [
			{ throwEngineError: true } as any,
		]);
		const ac = new AccessControl<SubjectNum, readonly ["read"], ResourceMapR>({
			actions: ["read"],
			getConditions,
		});
		const allowed = await ac.can({ id: 3 }).read({ type: "r" });
		expect(allowed).toBe(false);
		expect(getConditions).toHaveBeenCalled();
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});

	it("forwards action name to getConditions for multi-action configurations", async () => {
		const seenActions: string[] = [];
		const getConditions = vi.fn(async (_s, _r, action: string) => {
			seenActions.push(action);
			return [{ allow: false } as any];
		});
		const ac = new AccessControl<
			SubjectNum,
			readonly ["read", "update"],
			ResourceMapR
		>({
			actions: ["read", "update"],
			getConditions,
		});
		const api = ac.can({ id: 11 });
		await api.read({ type: "r" });
		await api.update({ type: "r" });
		expect(seenActions).toEqual(["read", "update"]);
	});
});
