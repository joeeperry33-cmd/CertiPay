/** A row of an annual percentage-method table. All amounts are whole dollars or dollars.cents. */
export interface Bracket {
  over: number; // dollars
  base: number; // tentative amount / "plus", dollars
  rate: number; // e.g. 0.12
}

/** Tax on an annual amount (dollars) from a bracket table, in dollars. */
export function fromBrackets(table: Bracket[], amount: number): number {
  let row = table[0];
  for (const b of table) {
    if (amount > b.over) row = b;
  }
  if (amount <= row.over) return 0;
  return row.base + (amount - row.over) * row.rate;
}

export const toDollars = (cents: number) => cents / 100;
export const toCents = (dollars: number) => Math.round(dollars * 100);
