import { expect, test } from "bun:test";

test("Vercel uses the same canonical dashboard route as Vite", async () => {
  const config = await Bun.file(new URL("../vercel.json", import.meta.url)).json();

  expect(config.trailingSlash).toBe(true);
  expect(config.rewrites).toBeUndefined();
});
