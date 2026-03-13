import { _, ChainAssertionError } from "../mod.ts";
import { assertEquals, assertRejects, assertThrows } from "@std/assert";

Deno.test("must() throws ChainAssertionError", () => {
  // must() on sync failure throws immediately because it accesses the value
  assertThrows(() => _(null).must("Failed"), ChainAssertionError, "Failed");
});

Deno.test("must() passes on success", () => {
  const result = _(10).must("Should not fail").unwrap();
  assertEquals(result, 10);
});

Deno.test("expect() throws ChainAssertionError", () => {
  assertThrows(() => _(null).expect("Failed"), ChainAssertionError, "Failed");
});

Deno.test("expect() passes on success", () => {
  const result = _(10).expect("Should not fail");
  assertEquals(result, 10);
});

Deno.test("Async must() throws ChainAssertionError", async () => {
  // Async must returns a Chain<Promise>, so the error happens when we unwrap (or await the promise inside)
  // The promise returned by .must() will be rejected.
  // Since .must() returns a Chain wrapping that promise, .unwrap() unwraps it.

  await assertRejects(
    () => _(Promise.resolve(null)).must("Async Failed").unwrap(),
    ChainAssertionError,
    "Async Failed",
  );
});

Deno.test("Async expect() throws ChainAssertionError", async () => {
  await assertRejects(
    () => _(Promise.resolve(null)).expect("Async Failed"),
    ChainAssertionError,
    "Async Failed",
  );
});

Deno.test("Async must() passes on success", async () => {
  const result = await _(Promise.resolve(10)).must("Async Success").unwrap();
  assertEquals(result, 10);
});

Deno.test("Async expect() passes on success", async () => {
  const result = await _(Promise.resolve(10)).expect("Async Success");
  assertEquals(result, 10);
});
