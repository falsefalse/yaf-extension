/* eslint-disable @typescript-eslint/no-explicit-any */

// https://www.karltarvas.com/2021/03/11/typescript-array-filter-boolean.html
type Falsy = false | 0 | '' | null | undefined

interface Array<T> {
  filter<S extends T>(
    predicate: BooleanConstructor,
    thisArg?: any
  ): Exclude<S, Falsy>[]
}
