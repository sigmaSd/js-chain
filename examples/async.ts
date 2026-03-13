import { _ } from "../mod.ts";

/**
 * This example demonstrates using @sigma/chain with Deno's async APIs.
 * The wrapper is "async-aware", meaning if you wrap a Promise,
 * you can continue to chain properties and methods as if it were the resolved value.
 * The final result will be a Promise.
 */

async function main() {
  console.log("--- Async Example ---");

  // 1. Fetching from a URL
  // We wrap the fetch promise and chain .json() and property access
  const repoName = await _(fetch("https://api.github.com/repos/denoland/deno"))
    .json()
    .full_name
    .unwrap();

  console.log(`Fetched Repo: ${repoName}`);

  // 2. Reading a file (Async)
  // We wrap the Deno.readTextFile promise
  const version = await _(Deno.readTextFile("jsr.json"))
    .pipe(JSON.parse)
    .version
    .unwrap();

  console.log(`Version from jsr.json: ${version}`);

  // 3. Handling errors in async chains
  const missing = await _(Promise.resolve({}))
    .nonExistent
    .method()
    .or("Fallback Value");

  console.log(`Result of missing method: ${missing}`);

  // 4. Using .tap() with async side-effects
  await _(Promise.resolve("hello"))
    .tap(async (val) => {
      console.log(`Tapping into: ${val}`);
      await new Promise((r) => setTimeout(r, 100));
      console.log("Async side-effect complete");
    })
    .unwrap();
}

if (import.meta.main) {
  main();
}
