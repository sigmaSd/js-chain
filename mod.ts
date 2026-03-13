/**
 * A "magic" wrapper that provides safe navigation and utility methods.
 */
// deno-lint-ignore-file no-explicit-any

/** Error thrown when a chain assertion fails (must/expect). */
export class ChainAssertionError extends Error {
  /**
   * Constructs a new ChainAssertionError.
   * @param message The error message.
   * @param options Optional error options, such as the cause.
   */
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ChainAssertionError";
  }
}

/** Utility type to determine if a given type is exactly `any`. */
export type IsAny<T> = 0 extends (1 & T) ? true : false;

/** Internal symbol to identify Chain instances. */
export const IS_CHAIN: symbol = Symbol.for("@sigma/chain/isChain");

/** Returns true if the value is a Chain wrapper. */
export function isChain(val: any): val is Chain<any> {
  return !!val && (typeof val === "object" || typeof val === "function") &&
    (val as any)[IS_CHAIN] === true;
}

/** Utility methods for the Chain wrapper. */
export type ChainUtils<T> = {
  /** Returns the underlying value if no error occurred, otherwise returns the fallback. */
  or(
    fallback: Awaited<T>,
  ): T extends Promise<any> ? Promise<Awaited<T>> : Awaited<T>;
  /** Returns the underlying value or throws ChainAssertionError with the given message if an error occurred. */
  must(msg: string, verbose?: boolean): Chain<T>;
  /** Returns the underlying value or throws ChainAssertionError with the given message if an error occurred. Terminal. */
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
              K in keyof Awaited<T> as K extends
                (keyof ChainUtils<any> | symbol) ? never
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
            K in keyof Awaited<T> as K extends (keyof ChainUtils<any> | symbol)
              ? never
              : K
          ]: Chain<Awaited<T>[K]>;
        }
        & { [K: string]: Chain<any> } // Fallback for magic navigation
        & { [K: symbol]: any } // Allow raw symbol access
  );

/**
 * Wraps a value in a safe proxy for error-tolerant chaining.
 */
export function _<T>(value: T, error?: unknown): Chain<T> {
  const isPromise = value instanceof Promise;
  const hasValue = value !== undefined && value !== null;
  // A chain is considered "failed" if it has no value (is null/undefined).
  // This affects or().
  // unwrap() should throw if there is ANY error or no value.
  const hasAnyError = error !== undefined || !hasValue;

  // Use a dummy function as the target to make the Proxy callable.
  const target = (() => {}) as unknown as Chain<T>;

  return new Proxy(target, {
    get(_target, prop) {
      if (prop === IS_CHAIN) return true;
      if (typeof prop === "symbol") {
        return (value as any)?.[prop];
      }

      if (prop === "or") {
        return (fallback: any) => {
          if (isPromise) {
            return (value as Promise<any>).then((v) =>
              (v === null || v === undefined) ? fallback : v
            )
              .catch(() => fallback);
          }
          return hasAnyError ? fallback : value;
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
          if (hasAnyError) {
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
                  throw new ChainAssertionError(msg);
                }
                return v;
              }).catch((err) => {
                if (verbose) {
                  console.error(`\x1b[31m${msg}\x1b[0m`);
                  if (err && !(err instanceof ChainAssertionError)) {
                    console.error(err);
                  }
                }
                if (err instanceof ChainAssertionError) throw err;
                throw new ChainAssertionError(msg, { cause: err });
              }),
            );
          }
          if (hasAnyError) {
            if (verbose) {
              console.error(`\x1b[31m${msg}\x1b[0m`);
              if (error) console.error(error);
            }
            throw new ChainAssertionError(msg, { cause: error });
          }
          return _(value);
        };
      }
      if (prop === "expect") {
        return (msg: string, verbose = true) => {
          if (isPromise) {
            return (value as Promise<any>).then((v) => {
              if (v === null || v === undefined) {
                if (verbose) console.error(`\x1b[31m${msg}\x1b[0m`);
                throw new ChainAssertionError(msg);
              }
              return v;
            }).catch((err) => {
              if (verbose) {
                console.error(`\x1b[31m${msg}\x1b[0m`);
                if (err && !(err instanceof ChainAssertionError)) {
                  console.error(err);
                }
              }
              if (err instanceof ChainAssertionError) throw err;
              throw new ChainAssertionError(msg, { cause: err });
            });
          }
          if (hasAnyError) {
            if (verbose) {
              console.error(`\x1b[31m${msg}\x1b[0m`);
              if (error) console.error(error);
            }
            throw new ChainAssertionError(msg, { cause: error });
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
          if (hasAnyError) return _(undefined as unknown as U, error);
          try {
            const next = fn(value);
            return _(next);
          } catch (err) {
            return _(undefined as unknown as U, err);
          }
        };
      }
      if (prop === "tap") {
        return (fn: (v: any) => void) => {
          if (isPromise) {
            return _(
              (value as Promise<any>).then(async (v) => {
                try {
                  await fn(v);
                  return v;
                } catch (err) {
                  throw err;
                }
              }).catch((err) => {
                throw err;
              }),
            );
          }
          if (error !== undefined) return _(value, error);
          if (!hasValue) return _(value, error);
          try {
            const res = fn(value) as any;
            if (res instanceof Promise) {
              return _(
                res.then(() => value).catch((err) => {
                  throw err;
                }),
              );
            }
            return _(value);
          } catch (err) {
            return _(value, err); // Preserve value
          }
        };
      }
      if (prop === "log") {
        return (prefix?: string) => {
          const p = prefix ? `${prefix} ` : "";
          if (isPromise) {
            return _(
              (value as Promise<any>).then((v) => {
                console.log(`${p}[Value]:`, v);
                return v;
              }).catch((err) => {
                console.log(`${p}[Error]:`, err);
                throw err;
              }),
            );
          }
          if (error !== undefined) {
            console.log(`${p}[Error]:`, error);
          } else if (value === null || value === undefined) {
            console.log(`${p}[Empty]:`, value);
          } else {
            console.log(`${p}[Value]:`, value);
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

      if (hasAnyError) {
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
      } catch (err) {
        return _(undefined as unknown as T, err);
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
      if (hasAnyError) {
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
      } catch (err) {
        return _(undefined as unknown as T, err);
      }
    },
  }) as Chain<T>;
}
