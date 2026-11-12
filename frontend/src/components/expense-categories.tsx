import { cn } from "@/components/lib/utils"
import {
  Baby,
  Bath,
  Briefcase,
  Car,
  CreditCard,
  Dog,
  Dumbbell,
  Ellipsis,
  FileChartLine,
  Gift,
  GraduationCap,
  HelpingHand,
  Home,
  HousePlus,
  type LucideIcon,
  Plane,
  Plug,
  Receipt,
  Scale,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Stethoscope,
  TrendingUp,
  Tv,
  Utensils,
} from "lucide-react"
import { components } from "schema"

export type ExpenseCategory = components["schemas"]["ExpenseCategory"]

const categories = {
  FoodDining: { name: "Food & Dining", icon: Utensils },
  Groceries: { name: "Groceries", icon: ShoppingCart },
  Transportation: { name: "Transportation", icon: Car },
  HousingRent: { name: "Housing & Rent", icon: Home },
  Utilities: { name: "Utilities", icon: Plug },
  Healthcare: { name: "Healthcare", icon: Stethoscope },
  Entertainment: { name: "Entertainment", icon: Tv },
  Shopping: { name: "Shopping", icon: ShoppingBag },
  Education: { name: "Education", icon: GraduationCap },
  Travel: { name: "Travel", icon: Plane },
  PersonalCare: { name: "Personal Care", icon: Bath },
  Fitness: { name: "Fitness", icon: Dumbbell },
  Subscriptions: { name: "Subscriptions", icon: CreditCard },
  BillsPayments: { name: "Bills & Payments", icon: Receipt },
  BusinessExpenses: { name: "Business Expenses", icon: Briefcase },
  Investments: { name: "Investments", icon: TrendingUp },
  Insurance: { name: "Insurance", icon: Shield },
  Gifts: { name: "Gifts", icon: Gift },
  Charity: { name: "Charity", icon: HelpingHand },
  Miscellaneous: { name: "Miscellaneous", icon: Ellipsis },
  HomeHouseholdSupplies: { name: "Home & Household Supplies", icon: HousePlus },
  Childcare: { name: "Childcare", icon: Baby },
  Pets: { name: "Pets", icon: Dog },
  ProfessionalServices: { name: "Professional Services", icon: Scale },
  Taxes: { name: "Taxes", icon: FileChartLine },
} satisfies Record<ExpenseCategory, { name: string; icon: LucideIcon }>

/** All categories, sorted by display name. */
export const expenseCategories = (
  Object.keys(categories) as ExpenseCategory[]
).sort((a, b) => categories[a].name.localeCompare(categories[b].name))

export const categoryToDisplayName = ({
  category,
}: {
  category: ExpenseCategory
}) => categories[category].name

export const ExpenseIcon = ({
  category,
  className,
}: {
  category: ExpenseCategory
  className?: string
}) => {
  const Icon = categories[category].icon
  return <Icon className={cn("size-4", className)} />
}
