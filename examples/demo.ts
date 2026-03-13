import { _ } from "../mod.ts";

// 1. Safe Property Access & Chaining (Type-Safe)
// TS knows the structure of the JSON object after JSON.parse
const version = _("jsr.json")
  .pipe(Deno.readTextFileSync)
  .pipe(JSON.parse)
  .version
  .expect("Version not found");
console.log(`Version: ${version}`);

// 2. Error Recovery with .or() (Type-Safe navigation)
const author = _({ name: "sigma" })
  .author
  .name
  .or("Anonymous");
console.log(`Author: ${author}`);

// 3. Side Effects and Logging
_({ counts: [1, 2, 3] })
  .counts
  .tap((c) => console.log(`Processing ${c.length} items`))
  .log("Debug Counts")
  .pipe((c) => c.reduce((a: number, b: number) => a + b, 0))
  .tap((sum) => console.log(`Sum: ${sum}`));

// 4. Safe Function Calls & Chaining Primitive Methods
// We use .pipe() to stay in the Safe wrapper when calling primitive methods
// that TS doesn't automatically wrap.
const shout = (s: string) => s.toUpperCase();
const result = _("hello")
  .pipe(shout)
  .pipe((s) => s.concat(" world"))
  .unwrap();
console.log(result);

// 5. Chainable Validation with .must()
const config = _({ port: 8080 })
  .must("Config is missing")
  .port
  .unwrap();
console.log(`Port: ${config}`);

// 6. Runtime Safety Demo ("Magic" navigation)
const missing = _(null)
  .nonExistent
  .methodCall()
  .or("Default Value");
console.log(`Missing: ${missing}`);
