import { Hono } from "hono";
import { ResourceManager } from "@/registry/lib/auth/abac";

const app = new Hono();
const test = new ResourceManager<
	{
		abc: { type: "abc"; extra: number };
		cde: { type: "cde" };
	},
	{ id: number }
>(new Set(["add", "update"]));

app.get("/", (c) => {
	test.handle({ type: "abc", extra: 123 });
	return c.text("Hello Hono!");
});

export default app;
