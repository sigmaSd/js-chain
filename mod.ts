/**
 * A "magic" wrapper that provides safe navigation and utility methods.
 */
// deno-lint-ignore-file no-explicit-any
import process from "node:process";

type IsAny<T> = 0 extends (1 & T) ? true : false;

/** Utility methods for the Chain wrapper. */
export type ChainUtils<T> = {
  /** Returns the underlying value if no error occurred, otherwise returns the fallback. */
  or(
    fallback: Awaited<T>,
  ): T extends Promise<any> ? Promise<Awaited<T>> : Awaited<T>;
  /** Returns the underlying value or exits the process with the given message if an error occurred. */
  must(msg: string, verbose?: boolean): Chain<T>;
  /** Returns the underlying value or exits the process with the given message if an error occurred. Terminal. */
  expect(
    msg: string,
    verbose?: boolean,
  ): T extends Promise<any> ? Promise<Awaited<T>> : Awaited<T>;
  /** Chains a transformation function. */
  pipe<U>(
    fn: (value: Awaited<T>) => U,
  ): Chain<T extends Promise<any> ? Promise<Awaited<U>> : Awaited<U>>;
  /** Chains a side-effect. Returns the original Chain wrapper. */
  tap(fn: (value: Awaited<T>) => void | Promise<void>): Chain<T>;
  /** Logs the current value and returns the same Chain wrapper. */
  log(prefix?: string): Chain<T>;
  /** Returns the underlying value. Throws the captured error if one occurred. */
  unwrap(): T extends Promise<any> ? Promise<Awaited<T>> : Awaited<T>;
};

/** The "magic" wrapper type. */
export type Chain<T> =
  & ChainUtils<T>
  & (
    IsAny<T> extends true ? {
        (...args: any[]): Chain<any>;
        [K: string]: Chain<any>;
        name: Chain<any>;
        length: Chain<any>;
      }
      : [T] extends [never] ? {
          (...args: any[]): Chain<any>;
          [K: string]: Chain<any>;
        }
      : T extends Promise<any> ?
          & {
            [
              K in keyof Awaited<T> as K extends keyof ChainUtils<any> ? never
                : K
            ]: Chain<Promise<Awaited<T>[K]>>;
          }
          & { [K: string]: Chain<Promise<any>> }
          & {
            (...args: any[]): Chain<Promise<any>>;
          }
      :
        & (Awaited<T> extends (...args: infer A) => infer R
          ? { (...args: A): Chain<R> } & {
            name: Chain<string>;
            length: Chain<number>;
          }
          : unknown)
        & {
          [
            K in keyof Awaited<T> as K extends keyof ChainUtils<any> ? never : K
          ]: Chain<Awaited<T>[K]>;
        }
        & { [K: string]: Chain<any> } // Fallback for magic navigation
  );

/**
 * Wraps a value in a safe proxy for error-tolerant chaining.
 */
export function _<T>(value: T, error?: unknown): Chain<T> {
  const isPromise = value instanceof Promise;
  const hasError = !isPromise &&
    (error !== undefined || value === undefined || value === null);

  // Use a dummy function as the target to make the Proxy callable.
  const target = (() => {}) as unknown as Chain<T>;

  return new Proxy(target, {
    get(_target, prop) {
      if (prop === "or") {
        return (fallback: any) => {
          if (isPromise) {
            return (value as Promise<any>).then((v) =>
              (v === null || v === undefined) ? fallback : v
            )
              .catch(() => fallback);
          }
          return hasError ? fallback : value;
        };
      }
      if (prop === "unwrap") {
        return () => {
          if (isPromise) {
            return (value as Promise<any>).then((v) => {
              if (v === null || v === undefined) {
                throw new Error("Value is null or undefined");
              }
              return v;
            });
          }
          if (hasError) {
            if (error) throw error;
            throw new Error("Value is null or undefined");
          }
          return value;
        };
      }
      if (prop === "must") {
        return (msg: string, verbose = false) => {
          if (isPromise) {
            return _(
              (value as Promise<any>).then((v) => {
                if (v === null || v === undefined) {
                  console.error(`\x1b[31m${msg}\x1b[0m`);
                  process.exit(1);
                }
                return v;
              }).catch((err) => {
                console.error(`\x1b[31m${msg}\x1b[0m`);
                if (verbose) console.error(err);
                process.exit(1);
              }),
            );
          }
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
          if (isPromise) {
            return (value as Promise<any>).then((v) => {
              if (v === null || v === undefined) {
                console.error(`\x1b[31m${msg}\x1b[0m`);
                process.exit(1);
              }
              return v;
            }).catch((err) => {
              console.error(`\x1b[31m${msg}\x1b[0m`);
              if (verbose) console.error(err);
              process.exit(1);
            });
          }
          if (hasError) {
            console.error(`\x1b[31m${msg}\x1b[0m`);
            if (verbose && error) console.error(error);
            process.exit(1);
          }
          return value;
        };
      }
      if (prop === "pipe") {
        return <U>(fn: (v: any) => U) => {
          if (isPromise) {
            return _(
              (value as Promise<any>).then((v) => fn(v)).catch((err) => {
                throw err;
              }),
            );
          }
          if (hasError) return _(undefined as unknown as U, error);
          try {
            const next = fn(value);
            return _(next);
          } catch (error) {
            return _(undefined as unknown as U, error);
          }
        };
      }
      if (prop === "tap") {
        return (fn: (v: any) => void) => {
          if (isPromise) {
            return _(
              (value as Promise<any>).then(async (v) => {
                await fn(v);
                return v;
              }),
            );
          }
          if (hasError) return _(value, error);
          try {
            const res = fn(value) as any;
            if (res instanceof Promise) {
              return _(res.then(() => value));
            }
            return _(value);
          } catch (error) {
            return _(undefined as unknown as T, error);
          }
        };
      }
      if (prop === "log") {
        return (prefix?: string) => {
          if (isPromise) {
            return _(
              (value as Promise<any>).then((v) => {
                console.log(`${prefix ?? ""}[Value]:`, v);
                return v;
              }).catch((err) => {
                console.log(`${prefix ?? ""}[Error]:`, err);
                throw err;
              }),
            );
          }
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

      if (isPromise) {
        return _(
          (value as Promise<any>).then((v) => {
            if (v === null || v === undefined) {
              throw new TypeError(
                `Cannot read properties of ${
                  v === null ? "null" : "undefined"
                } (reading '${String(prop)}')`,
              );
            }
            const next = (v as any)[prop];
            return typeof next === "function" ? next.bind(v) : next;
          }),
        );
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
        const next = (value as any)[prop];
        return typeof next === "function" ? _(next.bind(value)) : _(next);
      } catch (error) {
        return _(undefined as unknown as T, error);
      }
    },

    apply(_target, _thisArg, args) {
      if (isPromise) {
        return _(
          (value as Promise<any>).then((v) => {
            if (typeof v !== "function") {
              throw new TypeError(`${typeof v} is not a function`);
            }
            return v(...args);
          }),
        );
      }
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
        return _((value as any)(...args));
      } catch (error) {
        return _(undefined as unknown as T, error);
      }
    },
  }) as Chain<T>;
}
