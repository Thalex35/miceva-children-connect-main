// Minimal ambient declaration for Bun's built-in test runner (`bun:test`).
//
// The project has no test runner dependency yet, and Bun (already the
// project's package manager/runtime) ships one for free — so tests are
// written against it directly rather than adding vitest/jest as a new
// dependency. This file only exists so `tsc --noEmit` can resolve the
// `bun:test` import; it is not a reimplementation of the runner itself.
declare module "bun:test" {
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function expect<T>(value: T): {
    toBe(expected: T): void;
    toEqual(expected: unknown): void;
    toBeNull(): void;
    toBeCloseTo(expected: number, precision?: number): void;
  };
}
