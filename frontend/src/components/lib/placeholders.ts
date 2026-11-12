import { useState } from "react"

export const placeholders = {
  expenseName: [
    "Dinner at Urban Hearth",
    "Burgers at Mr. Bartley's",
    "Burnt caramel at Toscanini's",
    "Burritos at Felipe's",
    "Pastries from Flour",
    "Cheese from Formaggio",
    "Pizza at Pinocchio's",
    "Bluebikes to Kendall",
    "Tickets at the Sinclair",
    "Show at the Middle East",
    "Books from Harvard Book Store",
    "Guinness at the Plough",
  ],
  expenseNote: [
    "Splitting the large fries, as agreed",
    "After the Head of the Charles",
    "Picnic at Fresh Pond",
    "Red Line was down again, so we Ubered",
    "Double feature at the Sinclair",
  ],
  poolName: [
    "Inman Square apartment",
    "Head of the Charles weekend",
    "Central Square roommates",
    "Porter Square book club",
    "Harvard Square regulars",
  ],
  poolDescription: [
    "Rent, utilities and groceries for our place off Prospect St",
    "Regatta snacks, Bluebikes and one too many Tasty Burgers",
    "Everything we split between Mass Ave and the river",
  ],
  ruleExpression: [
    "bluebikes|mbta|charliecard",
    "toscanini|j\\.p\\. licks",
    "formaggio|star market|market basket",
  ],
  friendEmail: [
    "john.harvard@example.com",
    "tim.the.beaver@example.com",
    "paul.revere@example.com",
  ],
  venmoHandle: ["@tim-the-beaver", "@john-harvard", "@mr-bartley"],
} satisfies Record<string, string[]>

export type PlaceholderKind = keyof typeof placeholders

/** A random example for this field, stable while the component is mounted. */
export function usePlaceholder(kind: PlaceholderKind, prefix = "e.g. ") {
  const [text] = useState(() => {
    const options = placeholders[kind]
    return prefix + options[Math.floor(Math.random() * options.length)]
  })
  return text
}
