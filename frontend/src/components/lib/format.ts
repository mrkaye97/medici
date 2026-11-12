export const formatDate = (date: Date) =>
  date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

/** Always formats the absolute value; callers say "owe" vs "owed". */
export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.abs(amount))

export const round = (num: number) => Number(num.toFixed(2))

export const initials = (first: string, last: string) =>
  `${first.at(0) ?? ""}${last.at(0) ?? ""}`.toUpperCase()
