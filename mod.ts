/**
 * A "magic" wrapper that provides safe navigation and utility methods.
 */
export type Safe<T> =
  // 1. If the value is a function, the wrapper is callable.
  // deno-lint-ignore no-explicit-any
  & (T extends (...args: any[]) => any
    ? (...args: Parameters<T>) => Safe<ReturnType<T>>
    : unknown)
  // 2. Map existing properties of T to Safe versions.
  & { [K in keyof T]: Safe<T[K]> }
  // 3. Utility methods.
  & {
    /** Returns the underlying value if no error occurred, otherwise returns the fallback. */
    or(fallback: T): T;
    /** Returns the underlying value or exits the process with the given message if an error occurred. */
    must(msg: string, verbose?: boolean): Safe<T>;
    /** Returns the underlying value or exits the process with the given message if an error occurred. Terminal. */
    expect(msg: string, verbose?: boolean): T;
    /** Chains a transformation function. */
    pipe<U>(fn: (val: T) => U): Safe<U>;
    /** Chains a side-effect. Returns the original Safe wrapper. */
    tap(fn: (val: T) => void): Safe<T>;
    /** Logs the current value and returns the same Safe wrapper. */
    log(prefix?: string): Safe<T>;
    /** Returns the underlying value. Throws the captured error if one occurred. */
    unwrap(): T;
  };

/**
 * Wraps a value in a Safe proxy for error-tolerant chaining.
 */
export function _<T>(val: T, error?: unknown): Safe<T> {
  const isErr = error !== undefined || val === undefined || val === null;

  // Use a dummy function as the target to make the Proxy callable.
  const target = (() => {}) as unknown as Safe<T>;

  return new Proxy(target, {
    get(_target, prop) {
      if (prop === "or") return (fallback: T) => isErr ? fallback : val;
      if (prop === "unwrap") {
        return () => {
          if (isErr) {
            if (error) throw error;
            throw new Error("Value is null or undefined");
          }
          return val;
        };
      }
      if (prop === "must") {
        return (msg: string, verbose = false) => {
          if (isErr) {
            console.error(`\x1b[31m${msg}\x1b[0m`);
            if (verbose && error) console.error(error);
            Deno.exit(1);
          }
          return _(val);
        };
      }
      if (prop === "expect") {
        return (msg: string, verbose = true) => {
          if (isErr) {
            console.error(`\x1b[31m${msg}\x1b[0m`);
            if (verbose && error) console.error(error);
            Deno.exit(1);
          }
          return val;
        };
      }
      if (prop === "pipe") {
        return <U>(fn: (v: T) => U) => {
          if (isErr) return _(undefined as unknown as U, error);
          try {
            return _(fn(val));
          } catch (e) {
            return _(undefined as unknown as U, e);
          }
        };
      }
      if (prop === "tap") {
        return (fn: (v: T) => void) => {
          if (isErr) return _(val, error);
          try {
            fn(val);
            return _(val);
          } catch (e) {
            return _(undefined as unknown as T, e);
          }
        };
      }
      if (prop === "log") {
        return (prefix?: string) => {
          if (isErr) {
            console.log(
              `${prefix ?? ""}[Error]:`,
              error ?? "value is null/undefined",
            );
          } else {
            console.log(`${prefix ?? ""}[Value]:`, val);
          }
          return _(val, error);
        };
      }

      if (isErr) {
        return _(
          undefined as unknown as T,
          error ??
            new TypeError(
              `Cannot read properties of ${
                val === null ? "null" : "undefined"
              } (reading '${String(prop)}')`,
            ),
        );
      }

      try {
        // deno-lint-ignore no-explicit-any
        const next = (val as any)[prop];
        return typeof next === "function" ? _(next.bind(val)) : _(next);
      } catch (e) {
        return _(undefined as unknown as T, e);
      }
    },

    apply(_target, _thisArg, args) {
      if (isErr) {
        return _(
          undefined as unknown as T,
          error ??
            new TypeError(
              `${val === null ? "null" : "undefined"} is not a function`,
            ),
        );
      }
      try {
        // deno-lint-ignore no-explicit-any
        return _((val as any)(...args));
      } catch (e) {
        return _(undefined as unknown as T, e);
      }
    },
  }) as Safe<T>;
}
