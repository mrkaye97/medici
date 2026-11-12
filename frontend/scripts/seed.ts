/**
 * Fill a local Medici database with realistic demo data, through the API (so
 * every validation and trigger applies, exactly like real use).
 *
 *   pnpm seed                      # against http://localhost:8000
 *   SEED_API_URL=http://localhost:8010 pnpm seed
 *   SEED_EMAIL=you@example.com pnpm seed
 *
 * It creates a demo account plus eight friends, each with their own email
 * (`*@medici.test`, a reserved domain, so nothing is ever emailed). Running
 * it again creates a fresh, separate set. Log in as the demo account it
 * prints. With SEED_EMAIL set, a few of the people also send friend
 * requests to that existing account, so you can accept them and add
 * them to your own pools.
 *
 * Only for local development: the accounts all share a published password.
 */
import createClient from "openapi-fetch"
import type { components, paths } from "../schema"

type Category = components["schemas"]["ExpenseCategory"]

const API_URL = (process.env.SEED_API_URL ?? "http://localhost:8000").replace(
  /\/$/,
  ""
)
const PASSWORD = "medici-dev-password"
const RUN = Date.now().toString(36)

const api = createClient<paths>({ baseUrl: API_URL })

const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

/** Unwrap an openapi-fetch result, failing loudly with the server's error. */
function ok<T>(
  label: string,
  result: { data?: T; error?: unknown; response: Response }
): T {
  if (result.error !== undefined || !result.response.ok) {
    throw new Error(
      `${label} failed (${result.response.status}): ${JSON.stringify(result.error)}`
    )
  }
  return result.data as T
}

type Person = { id: string; token: string; first: string; email: string }

async function signup(
  first: string,
  last: string,
  venmo?: string
): Promise<Person> {
  const email = `${first.toLowerCase()}.${RUN}@medici.test`
  const result = ok(
    `sign up ${first}`,
    await api.POST("/api/signup", {
      body: { email, password: PASSWORD, first_name: first, last_name: last },
    })
  )
  const person = { id: result.id, token: result.token, first, email }

  if (venmo) {
    ok(
      `set ${first}'s Venmo`,
      await api.PATCH("/api/members/me", {
        body: { venmo_handle: `${venmo}-${RUN}` },
        headers: auth(person.token),
      })
    )
  }
  return person
}

async function befriend(a: Person, b: Person) {
  // A request in each direction: the second one accepts the first.
  for (const [from, to] of [
    [a, b],
    [b, a],
  ]) {
    ok(
      `friend request ${from.first} -> ${to.first}`,
      await api.POST("/api/friend-requests", {
        body: { friend_email: to.email },
        headers: auth(from.token),
      })
    )
  }
}

async function requestFriend(from: Person, toEmail: string) {
  ok(
    `friend request ${from.first} -> ${toEmail}`,
    await api.POST("/api/friend-requests", {
      body: { friend_email: toEmail },
      headers: auth(from.token),
    })
  )
}

/** Split 100% into hundredths that add up exactly (largest remainder). */
function evenPercentages(n: number) {
  const base = Math.floor(10000 / n)
  return Array.from(
    { length: n },
    (_, i) => (base + (i < 10000 - base * n ? 1 : 0)) / 100
  )
}

/** Split an amount into cents that add up exactly. */
function splitAmount(amount: number, weights: number[]) {
  const cents = Math.round(amount * 100)
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  const raw = weights.map(w => (cents * w) / totalWeight)
  const floored = raw.map(Math.floor)
  let leftover = cents - floored.reduce((a, b) => a + b, 0)
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac)
  for (const { i } of order) {
    if (leftover-- <= 0) break
    floored[i] += 1
  }
  return floored.map(c => c / 100)
}

type Pool = { id: string; name: string; admin: Person; members: Person[] }

async function createPool(
  admin: Person,
  name: string,
  description: string,
  others: Person[],
  splits?: number[]
): Promise<Pool> {
  const pool = ok(
    `create pool ${name}`,
    await api.POST("/api/pools", {
      body: { name, description },
      headers: auth(admin.token),
    })
  )

  for (const other of others) {
    ok(
      `add ${other.first} to ${name}`,
      await api.POST("/api/pools/{pool_id}/members", {
        params: { path: { pool_id: pool.id } },
        body: { member_id: other.id },
        headers: auth(admin.token),
      })
    )
  }

  const members = [admin, ...others]
  const percentages = splits ?? evenPercentages(members.length)
  ok(
    `set splits for ${name}`,
    await api.PATCH("/api/pools/{pool_id}/default-splits", {
      params: { path: { pool_id: pool.id } },
      body: {
        default_split_percentages: members.map((m, i) => ({
          member_id: m.id,
          split_percentage: percentages[i],
        })),
      },
      headers: auth(admin.token),
    })
  )

  return { id: pool.id, name, admin, members }
}

type ExpenseSpec = {
  name: string
  amount: number
  category: Category
  paidBy: Person
  /** Who shares it, and in what proportion. Defaults to everyone equally. */
  shares?: [Person, number][]
  description?: string
}

async function addExpense(pool: Pool, spec: ExpenseSpec) {
  const shares =
    spec.shares ?? pool.members.map(m => [m, 1] as [Person, number])
  const amounts = splitAmount(
    spec.amount,
    shares.map(([, w]) => w)
  )
  ok(
    `add ${spec.name} to ${pool.name}`,
    await api.POST("/api/pools/{pool_id}/expenses", {
      params: { path: { pool_id: pool.id } },
      body: {
        pool_id: pool.id,
        paid_by_member_id: spec.paidBy.id,
        name: spec.name,
        amount: spec.amount,
        category: spec.category,
        description: spec.description,
        split_method: "Amount",
        line_items: shares.map(([person], i) => ({
          debtor_member_id: person.id,
          amount: amounts[i],
        })),
      },
      headers: auth(spec.paidBy.token),
    })
  )
}

async function settleUp(pool: Pool, who: Person, withWhom?: Person) {
  ok(
    `${who.first} settles up in ${pool.name}`,
    await api.POST("/api/pools/{pool_id}/settle-up", {
      params: { path: { pool_id: pool.id } },
      body: { member_id: withWhom?.id ?? null },
      headers: auth(who.token),
    })
  )
}

async function hidePool(pool: Pool, who: Person) {
  ok(
    `${who.first} hides ${pool.name}`,
    await api.POST("/api/pools/{pool_id}/toggle-hidden", {
      params: { path: { pool_id: pool.id } },
      body: { is_hidden: true },
      headers: auth(who.token),
    })
  )
}

async function addRule(who: Person, rule: string, category: Category) {
  ok(
    `rule ${rule}`,
    await api.POST("/api/rules", {
      body: { rule, category },
      headers: auth(who.token),
    })
  )
}

/** Deterministic pseudo-random numbers, so every run looks the same. */
function makeRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32
    return s / 2 ** 32
  }
}

async function main() {
  const health = await fetch(`${API_URL}/api/openapi.json`).catch(() => null)
  if (!health?.ok) {
    throw new Error(
      `Can't reach the Medici server at ${API_URL}. Is it running?`
    )
  }

  const random = makeRandom(97)
  const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)]
  const price = (min: number, max: number) =>
    Math.round((min + random() * (max - min)) * 100) / 100

  console.log(`Seeding ${API_URL} (run ${RUN})...`)

  const demo = await signup("Demo", "User", "demo-user")
  const sam = await signup("Sam", "Rivera", "sam-rivera")
  const priya = await signup("Priya", "Shah", "priya-shah")
  const jordan = await signup("Jordan", "Lee")
  const mei = await signup("Mei", "Chen", "mei-chen")
  const theo = await signup("Theo", "Okafor")
  const lucia = await signup("Lucia", "Moretti", "lucia-m")
  const noah = await signup("Noah", "Kim")
  const rosa = await signup("Rosa", "Alvarez")

  for (const friend of [sam, priya, jordan, mei, theo, lucia]) {
    await befriend(demo, friend)
  }
  await befriend(sam, priya)
  await befriend(sam, jordan)
  await befriend(priya, jordan)
  await befriend(mei, theo)
  await befriend(mei, lucia)
  await befriend(theo, lucia)

  // Pending requests: Noah wants to be friends with you; you asked Rosa.
  await requestFriend(noah, demo.email)
  await requestFriend(demo, rosa.email)

  // 1. Apartment: three roommates, lots of recurring bills, uneven rent.
  const apartment = await createPool(
    demo,
    "Apartment",
    "Rent, utilities and shared groceries",
    [sam, priya],
    [40, 30, 30]
  )
  const roommates = [demo, sam, priya]
  for (let month = 0; month < 6; month++) {
    await addExpense(apartment, {
      name: `Rent (month ${month + 1})`,
      amount: 3150,
      category: "HousingRent",
      paidBy: demo,
      shares: [
        [demo, 40],
        [sam, 30],
        [priya, 30],
      ],
    })
    await addExpense(apartment, {
      name: "Electric bill",
      amount: price(70, 140),
      category: "Utilities",
      paidBy: sam,
    })
    await addExpense(apartment, {
      name: "Internet",
      amount: 65,
      category: "Utilities",
      paidBy: priya,
    })
    for (let trip = 0; trip < 3; trip++) {
      await addExpense(apartment, {
        name: pick(["Trader Joe's", "Whole Foods", "Costco run", "Safeway"]),
        amount: price(25, 210),
        category: "Groceries",
        paidBy: pick(roommates),
      })
    }
  }
  await addExpense(apartment, {
    name: "Paper towels & dish soap",
    amount: 23.47,
    category: "HomeHouseholdSupplies",
    paidBy: priya,
  })
  await addExpense(apartment, {
    name: "Couch from Facebook Marketplace",
    amount: 450,
    category: "HomeHouseholdSupplies",
    paidBy: sam,
    description: "The green one. Delivery included.",
  })
  // Sam paid you back once already; Priya hasn't.
  await settleUp(apartment, sam, demo)
  await addExpense(apartment, {
    name: "Water bill",
    amount: 48.12,
    category: "Utilities",
    paidBy: demo,
  })

  // 2. Japan trip: five people, many categories, one person paid most.
  const japan = await createPool(
    mei,
    "Japan Trip 2026",
    "Tokyo, Kyoto & Osaka — two weeks in April",
    [demo, theo, lucia]
  )
  const travelers = [mei, demo, theo, lucia]
  const japanItems: [string, Category, number, number][] = [
    ["Flights SFO → HND", "Travel", 3200, 3600],
    ["Airbnb Shibuya", "Travel", 1400, 1700],
    ["Ryokan in Kyoto", "Travel", 900, 1100],
    ["JR passes", "Transportation", 1500, 1500],
    ["Ramen at Ichiran", "FoodDining", 40, 70],
    ["Sushi omakase", "FoodDining", 380, 520],
    ["7-Eleven snacks", "Groceries", 15, 40],
    ["teamLab Planets tickets", "Entertainment", 120, 140],
    ["Izakaya night", "FoodDining", 140, 260],
    ["Taxi from Shinjuku", "Transportation", 25, 45],
    ["Nara day trip", "Travel", 60, 110],
    ["Karaoke", "Entertainment", 55, 90],
    ["Pocket Wi-Fi rental", "Subscriptions", 70, 70],
    ["Don Quijote haul", "Shopping", 80, 190],
    ["Kaiseki dinner", "FoodDining", 520, 640],
  ]
  for (const [name, category, min, max] of japanItems) {
    await addExpense(japan, {
      name,
      amount: price(min, max),
      category,
      paidBy: random() < 0.55 ? mei : pick(travelers),
    })
  }
  await addExpense(japan, {
    name: "Matcha tasting (just us two)",
    amount: 64,
    category: "FoodDining",
    paidBy: demo,
    shares: [
      [demo, 1],
      [lucia, 1],
    ],
  })

  // 3. Lake house: small, recent, nobody has settled.
  const lake = await createPool(
    jordan,
    "Lake House Weekend",
    "Tahoe, Labor Day",
    [demo, sam, priya]
  )
  await addExpense(lake, {
    name: "Cabin rental",
    amount: 1280,
    category: "Travel",
    paidBy: jordan,
  })
  await addExpense(lake, {
    name: "Groceries for the weekend",
    amount: 236.81,
    category: "Groceries",
    paidBy: demo,
  })
  await addExpense(lake, {
    name: "Gas",
    amount: 74.5,
    category: "Transportation",
    paidBy: sam,
    shares: [
      [sam, 1],
      [demo, 1],
    ],
  })
  await addExpense(lake, {
    name: "Kayak rental",
    amount: 160,
    category: "Entertainment",
    paidBy: priya,
  })

  // 4. Dinner club: fully settled, so it shows "All settled up".
  const dinner = await createPool(demo, "Dinner Club", "First Fridays", [
    theo,
    lucia,
  ])
  await addExpense(dinner, {
    name: "Tacos el Gordo",
    amount: 87.3,
    category: "FoodDining",
    paidBy: theo,
  })
  await addExpense(dinner, {
    name: "Thai Basil",
    amount: 112.45,
    category: "FoodDining",
    paidBy: demo,
  })
  await settleUp(dinner, theo)
  await settleUp(dinner, lucia)

  // 5. An old trip you've hidden.
  const oldTrip = await createPool(sam, "Ski Trip 2025", "Mammoth", [
    demo,
    jordan,
  ])
  await addExpense(oldTrip, {
    name: "Lift tickets",
    amount: 597,
    category: "Entertainment",
    paidBy: sam,
  })
  await addExpense(oldTrip, {
    name: "Condo",
    amount: 840,
    category: "Travel",
    paidBy: jordan,
  })
  await settleUp(oldTrip, demo)
  await hidePool(oldTrip, demo)

  // 6. An empty pool, for the empty states.
  await createPool(demo, "Birthday Gift for Mom", "Splitting with Sam", [sam])

  for (const [rule, category] of [
    ["uber|lyft|taxi", "Transportation"],
    ["trader joe|whole foods|safeway|costco", "Groceries"],
    ["rent", "HousingRent"],
    ["electric|water|internet|gas bill", "Utilities"],
    ["netflix|spotify|hulu", "Subscriptions"],
  ] as [string, Category][]) {
    await addRule(demo, rule, category)
  }

  if (process.env.SEED_EMAIL) {
    for (const person of [sam, priya, mei]) {
      await requestFriend(person, process.env.SEED_EMAIL)
    }
    console.log(
      `Sam, Priya and Mei sent friend requests to ${process.env.SEED_EMAIL}.`
    )
  }

  console.log(`
Done. Log in as:
  email:    ${demo.email}
  password: ${PASSWORD}

(Every seeded account uses that password: ${[sam, priya, mei]
    .map(p => p.email)
    .join(", ")}, ...)`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
