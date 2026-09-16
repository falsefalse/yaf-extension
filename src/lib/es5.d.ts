type Falsy = false | 0 | '' | null | undefined

interface Array<T> {
  /**
   * `filter(Boolean)` drops the falsy members from the element type as well
   * @see https://www.karltarvas.com/2021/03/11/typescript-array-filter-boolean.html
   */
  filter<S extends T>(
    predicate: BooleanConstructor,
    thisArg?: unknown
  ): Exclude<S, Falsy>[]
}
