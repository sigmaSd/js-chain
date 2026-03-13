/**
 * A "magic" wrapper that provides safe navigation and utility methods.
 */
export type Safe<T> =
  // deno-lint-ignore no-explicit-any
  & (T extends (...args: any[]) => any
    ? (...args: Parameters<T>) => Safe<ReturnType<T>>
    : unknown)
  & { [K in keyof T]: Safe<T[K]> }
  & {
    /** Returns the underlying value if no error occurred, otherwise returns the fallback. */
    or(fallback: T): T;
    /** Returns the underlying value or exits the process with the given message if an error occurred. */
    must(msg: string): T;
    /** Chains a transformation function. */
    pipe<U>(fn: (val: T) => U): Safe<U>;
    /** Chains a side-effect. Returns the original Safe wrapper. */
    tap(fn: (val: T) => void): Safe<T>;
    /** Logs the current value and returns the same Safe wrapper. */
    log(prefix?: string): Safe<T>;
  };

/**
 * Wraps a value in a Safe proxy for error-tolerant chaining.
 */
export function _<T>(val: T, error?: unknown): Safe<T> {
  const isErr = error !== undefined || val === undefined || val === null;

  // Use a dummy function as the target to make the Proxy callable.
  // The actual logic is handled in the 'get' and 'apply' traps.
  const target = (() => {}) as unknown as Safe<T>;

  return new Proxy(target, {
    get(_target, prop) {
      // 1. Terminal: Extract value with a fallback
      if (prop === "or") {
        return (fallback: T) => isErr ? fallback : val;
      }

      // 2. Terminal: Exit on failure
      if (prop === "must") {
        return (msg: string) => {
          if (isErr) {
            console.error(`\x1b[31m${msg}\x1b[0m`);
            if (error) console.error(error);
            Deno.exit(1);
          }
          return val;
        };
      }

      // 3. Chain: Custom transformation
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

      // 4. Chain: Side effect
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

      // 5. Chain: Logging
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

      // 6. Chain: Property access
      if (isErr) return _(undefined as unknown as T, error);

      try {
        // deno-lint-ignore no-explicit-any
        const next = (val as any)[prop];
        // If the property is a function, bind it to preserve 'this'
        return typeof next === "function" ? _(next.bind(val)) : _(next);
      } catch (e) {
        return _(undefined as unknown as T, e);
      }
    },

    apply(_target, _thisArg, args) {
      if (isErr) return _(undefined as unknown as T, error);
      try {
        // deno-lint-ignore no-explicit-any
        return _((val as any)(...args));
      } catch (e) {
        return _(undefined as unknown as T, e);
      }
    },
  }) as Safe<T>;
}
