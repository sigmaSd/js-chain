// deno-lint-ignore-file no-explicit-any
import { assertEquals, assertThrows } from "jsr:@std/assert@1.0.19";
import { _ } from "./mod.ts";

Deno.test("Safe property access - success", () => {
  const obj = { a: { b: { c: 1 } } };
  const result = _(obj).a.b.c.unwrap();
  assertEquals(result, 1);
});

Deno.test("Safe property access - failure (null/undefined)", () => {
  const obj = { a: { b: null } };
  const result = _(obj).a.b.c.or(100);
  assertEquals(result, 100);
});

Deno.test("Safe function call - success", () => {
  const obj = {
    greet: (name: string) => `Hello, ${name}!`,
  };
  const result = _(obj).greet("World").unwrap();
  assertEquals(result, "Hello, World!");
});

Deno.test("Safe function call - failure", () => {
  const obj = {};
  const result = _(obj).missing().or("fallback");
  assertEquals(result, "fallback");
});

Deno.test("or() fallback", () => {
  assertEquals(_<string | null>(null).or("default"), "default");
  assertEquals(_<string | undefined>(undefined).or("default"), "default");
  assertEquals(_("value").or("default"), "value");
});

Deno.test("unwrap() throws captured error", () => {
  const err = new Error("Custom Error");
  const wrapped = _(undefined, err);
  assertThrows(() => wrapped.unwrap(), Error, "Custom Error");
});

Deno.test("unwrap() throws default error for null/undefined", () => {
  assertThrows(
    () => _<null>(null).unwrap(),
    Error,
    "Value is null or undefined",
  );
});

Deno.test("pipe() transforms value", () => {
  const result = _(10)
    .pipe((n: number) => n * 2)
    .pipe((n: number) => n + 5)
    .unwrap();
  assertEquals(result, 25);
});

Deno.test("pipe() catches errors", () => {
  const result = _(10)
    .pipe((_n: number): number => {
      throw new Error("Pipe Error");
    })
    .or(0);
  assertEquals(result, 0);
});

Deno.test("tap() executes side effect and returns same wrapper", () => {
  let sideEffect = 0;
  const result = _(10)
    .tap((n: number) => {
      sideEffect = n;
    })
    .unwrap();
  assertEquals(sideEffect, 10);
  assertEquals(result, 10);
});

Deno.test("tap() catches errors and continues as failed", () => {
  const result = _(10)
    .tap((_n: number) => {
      throw new Error("Tap Error");
    })
    .or(0);
  assertEquals(result, 0);
});

Deno.test("log() does not throw", () => {
  // Should not throw even if value is null
  _<null>(null).log("Test");
  _({ a: 1 }).log("Test");
});

Deno.test("Regression: 'name' property on any result (like JSON.parse)", () => {
  const val = _({ name: "my-package" } as any);
  // .name should be Chain<any>, which has .unwrap()
  const result = val.name.unwrap();
  assertEquals(result, "my-package");
});

Deno.test("Regression: 'length' property on any result", () => {
  const val = _({ length: 42 } as any);
  const result = val.length.unwrap();
  assertEquals(result, 42);
});

Deno.test("Regression: 'name' and 'length' property on function result", () => {
  const val = _((() => {}) as any);
  // Functions have built-in name and length, which were shadowed by string/number.
  // They should now be Chain<any>.
  assertEquals(typeof val.name.unwrap(), "string");
  assertEquals(typeof val.length.unwrap(), "number");
});

Deno.test("Deep chaining with errors", () => {
  const obj = {
    a: () => {
      throw new Error("Deep Error");
    },
  };
  const result = _(obj).a().b.c.or("failed");
  assertEquals(result, "failed");
});

Deno.test("Async property access", async () => {
  const p = Promise.resolve({ user: { name: "alice" } });
  const name = await _(p).user.name.unwrap();
  assertEquals(name, "alice");
});

Deno.test("Deep object navigation failure (no 'as any')", () => {
  const obj = { a: { b: 1 } };
  // @ts-ignore: testing magic navigation
  const val = _(obj).a.b.c.d.or(100);
  assertEquals(val, 100);
});
