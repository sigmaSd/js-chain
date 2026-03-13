/**
 * A "magic" wrapper that provides safe navigation and utility methods.
 */
import process from "node:process";

type IsAny<T> = 0 extends (1 & T) ? true : false;

// deno-lint-ignore ban-types
type NativeFunction = Function;

/** Utility methods for the Chain wrapper. */
export type ChainUtils<T> = {
  /** Returns the underlying value if no error occurred, otherwise returns the fallback. */
  or(fallback: T): T;
  /** Returns the underlying value or exits the process with the given message if an error occurred. */
  must(msg: string, verbose?: boolean): Chain<T>;
  /** Returns the underlying value or exits the process with the given message if an error occurred. Terminal. */
  expect(msg: string, verbose?: boolean): T;
  /** Chains a transformation function. */
  pipe<U>(fn: (value: T) => U): Chain<U>;
  /** Chains a side-effect. Returns the original Chain wrapper. */
  tap(fn: (value: T) => void): Chain<T>;
  /** Logs the current value and returns the same Chain wrapper. */
  log(prefix?: string): Chain<T>;
  /** Returns the underlying value. Throws the captured error if one occurred. */
  unwrap(): T;
};

/** The "magic" wrapper type. */
export type Chain<T> =
  & (IsAny<T> extends true ? {
      // deno-lint-ignore no-explicit-any
      (...args: any[]): Chain<any>;
      // deno-lint-ignore no-explicit-any
      [K: string]: Chain<any>;
      // deno-lint-ignore no-explicit-any
    } & { [K in keyof NativeFunction]: Chain<any> }
    :
      & (T extends (...args: infer A) => infer R ?
          & ((...args: A) => Chain<R>)
          & {
            [K in keyof NativeFunction]: Chain<(T & NativeFunction)[K]>;
          }
        : unknown)
      & (T extends null | undefined ? unknown : {
        [K in keyof T as K extends keyof ChainUtils<T> ? never : K]: Chain<
          T[K]
        >;
      }))
  & ChainUtils<T>;

/**
 * Wraps a value in a safe proxy for error-tolerant chaining.
 */
export function _<T>(value: T, error?: unknown): Chain<T> {
  const hasError = error !== undefined || value === undefined || value === null;

  // Use a dummy function as the target to make the Proxy callable.
  const target = (() => {}) as unknown as Chain<T>;

  return new Proxy(target, {
    get(_target, prop) {
      if (prop === "or") return (fallback: T) => hasError ? fallback : value;
      if (prop === "unwrap") {
        return () => {
          if (hasError) {
            if (error) throw error;
            throw new Error("Value is null or undefined");
          }
          return value;
        };
      }
      if (prop === "must") {
        return (msg: string, verbose = false) => {
          if (hasError) {
            console.error(`\x1b[31m${msg}\x1b[0m`);
            if (verbose && error) console.error(error);
            process.exit(1);
          }
          return _(value);
        };
      }
      if (prop === "expect") {
        return (msg: string, verbose = true) => {
          if (hasError) {
            console.error(`\x1b[31m${msg}\x1b[0m`);
            if (verbose && error) console.error(error);
            process.exit(1);
          }
          return value;
        };
      }
      if (prop === "pipe") {
        return <U>(fn: (v: T) => U) => {
          if (hasError) return _(undefined as unknown as U, error);
          try {
            return _(fn(value));
          } catch (error) {
            return _(undefined as unknown as U, error);
          }
        };
      }
      if (prop === "tap") {
        return (fn: (v: T) => void) => {
          if (hasError) return _(value, error);
          try {
            fn(value);
            return _(value);
          } catch (error) {
            return _(undefined as unknown as T, error);
          }
        };
      }
      if (prop === "log") {
        return (prefix?: string) => {
          if (hasError) {
            console.log(
              `${prefix ?? ""}[Error]:`,
              error ?? "value is null/undefined",
            );
          } else {
            console.log(`${prefix ?? ""}[Value]:`, value);
          }
          return _(value, error);
        };
      }

      if (hasError) {
        return _(
          undefined as unknown as T,
          error ??
            new TypeError(
              `Cannot read properties of ${
                value === null ? "null" : "undefined"
              } (reading '${String(prop)}')`,
            ),
        );
      }

      try {
        // deno-lint-ignore no-explicit-any
        const next = (value as any)[prop];
        return typeof next === "function" ? _(next.bind(value)) : _(next);
      } catch (error) {
        return _(undefined as unknown as T, error);
      }
    },

    apply(_target, _thisArg, args) {
      if (hasError) {
        return _(
          undefined as unknown as T,
          error ??
            new TypeError(
              `${value === null ? "null" : "undefined"} is not a function`,
            ),
        );
      }
      try {
        // deno-lint-ignore no-explicit-any
        return _((value as any)(...args));
      } catch (error) {
        return _(undefined as unknown as T, error);
      }
    },
  }) as Chain<T>;
}
