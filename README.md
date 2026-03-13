# @sigma/chain

A "magic" wrapper for safe navigation, error handling, and functional chaining
in TypeScript.

Inspired by the safe navigation operator (`?.`) but extended to handle errors,
fallbacks, and functional transformations in a single chain.

## Features

- **Safe Property Access**: Access deep properties without worrying about `null`
  or `undefined`.
- **Safe Function Calls**: Call methods and functions; if they throw, the error
  is captured.
- **Error Recovery**: Use `.or()` to provide fallbacks at any point in the
  chain.
- **Functional Piping**: Transform values with `.pipe()` and handle side-effects
  with `.tap()`.
- **Explicit Termination**: Use `.unwrap()`, `.must()`, or `.expect()` to get
  the value or handle failure.

## Comparison: Traditional vs. @sigma/chain

### Deep Object Navigation & Error Handling

**Traditional `try-catch`:**

```typescript
let port: number;
try {
  const content = Deno.readTextFileSync("config.json");
  const config = JSON.parse(content);
  port = config.server.port;
  if (port === undefined) throw new Error();
} catch (e) {
  port = 8080; // Fallback
}
console.log(`Port: ${port}`);
```

**With `@sigma/chain`:**

```typescript
import { _ } from "@sigma/chain";

const port = _("config.json")
  .pipe(Deno.readTextFileSync)
  .pipe(JSON.parse)
  .server.port
  .or(8080);

console.log(`Port: ${port}`);
```

### Safe API Interaction

**Traditional `if` checks:**

```typescript
const user = await Promise.resolve({
  profile: { getName: () => "user" as string },
});
let name = "Anonymous";

if (user && user.profile && user.profile.getName) {
  try {
    name = user.profile.getName();
  } catch (e) {
    // ignore or handle error
  }
}
```

**With `@sigma/chain`:**

```typescript
import { _ } from "@sigma/chain";
const user = await Promise.resolve({
  profile: { getName: () => "user" as string },
});
const name = _(user)
  .profile
  .getName()
  .or("Anonymous");
```

## Usage

### Installation

```bash
deno add jsr:@sigma/chain
```

```bash
npx jsr add @sigma/chain
```

```bash
bunx jsr add @sigma/chain
```

### Basic Example

```typescript
import { _ } from "@sigma/chain";

const result = _({ a: { b: 1 } })
  .a.b
  .pipe((n) => n * 2)
  .unwrap();

console.log(result); // 2
```

### Advanced Chaining

```typescript
import { _ } from "@sigma/chain";
_("some_input")
  .pipe((x) => x)
  .tap((val) => console.log("Current state:", val))
  .someMethod()
  .log("After method")
  .or("default value");
```

## API Reference

- `_(value)`: Wraps a value.
- `.or(fallback)`: Returns the value or the fallback if an error occurred or
  value is null/undefined.
- `.unwrap()`: Returns the value or throws the captured error.
- `.pipe(fn)`: Transforms the value using `fn`. Errors in `fn` are captured.
- `.tap(fn)`: Performs a side-effect.
- `.log(prefix?)`: Logs the current state (Value or Error).
- `.must(msg, verbose?)`: Exits process with message if failure.
- `.expect(msg, verbose?)`: Like `must` but returns the raw value.

## License

MIT
