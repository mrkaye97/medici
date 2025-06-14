import { apiClient } from "@/api/client"
import { useAuth } from "@/hooks/use-auth"
import { usePool } from "@/hooks/use-pool"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import {
  Baby,
  Bath,
  Briefcase,
  Car,
  CircleDollarSign,
  CirclePercent,
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
  Pin,
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
import { useCallback, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { components } from "schema"
import { z } from "zod"
import { Button } from "./ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { RadioGroup, RadioGroupItem } from "./ui/radio-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import { Textarea } from "./ui/textarea"

enum SplitMethodType {
  Percentage = "percentage",
  Amount = "amount",
  Default = "default",
}

export type ExpenseCategory = components["schemas"]["ExpenseCategory"]

export const expenseCategories: ExpenseCategory[] = [
  "FoodDining",
  "Groceries",
  "Transportation",
  "HousingRent",
  "Utilities",
  "Healthcare",
  "Entertainment",
  "Shopping",
  "Education",
  "Travel",
  "PersonalCare",
  "Fitness",
  "Subscriptions",
  "BillsPayments",
  "BusinessExpenses",
  "Investments",
  "Insurance",
  "Gifts",
  "Charity",
  "Miscellaneous",
  "HomeHouseholdSupplies",
  "Childcare",
  "Pets",
  "ProfessionalServices",
  "Taxes",
]

export const categoryToIcon = ({
  category,
  size = 4,
}: {
  category: ExpenseCategory
  size?: number
}) => {
  switch (category) {
    case "FoodDining":
      return <Utensils className={`size-${size}`} />
    case "Groceries":
      return <ShoppingCart className={`size-${size}`} />
    case "Transportation":
      return <Car className={`size-${size}`} />
    case "HousingRent":
      return <Home className={`size-${size}`} />
    case "Utilities":
      return <Plug className={`size-${size}`} />
    case "Healthcare":
      return <Stethoscope className={`size-${size}`} />
    case "Entertainment":
      return <Tv className={`size-${size}`} />
    case "Shopping":
      return <ShoppingBag className={`size-${size}`} />
    case "Education":
      return <GraduationCap className={`size-${size}`} />
    case "Travel":
      return <Plane className={`size-${size}`} />
    case "PersonalCare":
      return <Bath className={`size-${size}`} />
    case "Fitness":
      return <Dumbbell className={`size-${size}`} />
    case "Subscriptions":
      return <CreditCard className={`size-${size}`} />
    case "BillsPayments":
      return <Receipt className={`size-${size}`} />
    case "BusinessExpenses":
      return <Briefcase className={`size-${size}`} />
    case "Investments":
      return <TrendingUp className={`size-${size}`} />
    case "Insurance":
      return <Shield className={`size-${size}`} />
    case "Gifts":
      return <Gift className={`size-${size}`} />
    case "Charity":
      return <HelpingHand className={`size-${size}`} />
    case "Miscellaneous":
      return <Ellipsis className={`size-${size}`} />
    case "HomeHouseholdSupplies":
      return <HousePlus className={`size-${size}`} />
    case "Childcare":
      return <Baby className={`size-${size}`} />
    case "Pets":
      return <Dog className={`size-${size}`} />
    case "ProfessionalServices":
      return <Scale className={`size-${size}`} />
    case "Taxes":
      return <FileChartLine className={`size-${size}`} />
    default:
      const exhaustiveCheck: never = category
      throw new Error(`Unhandled category: ${exhaustiveCheck}`)
  }
}

export const categoryToDisplayName = ({
  category,
}: {
  category: ExpenseCategory
}) => {
  switch (category) {
    case "FoodDining":
      return "Food & Dining"
    case "Groceries":
      return "Groceries"
    case "Transportation":
      return "Transportation"
    case "HousingRent":
      return "Housing & Rent"
    case "Utilities":
      return "Utilities"
    case "Healthcare":
      return "Healthcare"
    case "Entertainment":
      return "Entertainment"
    case "Shopping":
      return "Shopping"
    case "Education":
      return "Education"
    case "Travel":
      return "Travel"
    case "PersonalCare":
      return "Personal Care"
    case "Fitness":
      return "Fitness"
    case "Subscriptions":
      return "Subscriptions"
    case "BillsPayments":
      return "Bills & Payments"
    case "BusinessExpenses":
      return "Business Expenses"
    case "Investments":
      return "Investments"
    case "Insurance":
      return "Insurance"
    case "Gifts":
      return "Gifts"
    case "Charity":
      return "Charity"
    case "Miscellaneous":
      return "Miscellaneous"
    case "Childcare":
      return "Childcare"
    case "HomeHouseholdSupplies":
      return "Home & Household Supplies"
    case "Pets":
      return "Pets"
    case "ProfessionalServices":
      return "Professional Services"
    case "Taxes":
      return "Taxes"
    default:
      const exhaustiveCheck: never = category
      throw new Error(`Unhandled category: ${exhaustiveCheck}`)
  }
}

export const ExpenseIcon = ({
  category,
  size = 4,
}: {
  category: ExpenseCategory
  size?: number
}) => {
  return categoryToIcon({ category, size })
}

const splitMethodType = Object.values(SplitMethodType)

function typeToLabelAndIcon(type: SplitMethodType) {
  switch (type) {
    case SplitMethodType.Default:
      return {
        label: "Split by default",
        icon: <Pin className="size-4" />,
      }
    case SplitMethodType.Amount:
      return {
        label: "Split by dollar amounts",
        icon: <CircleDollarSign className="size-4" />,
      }
    case SplitMethodType.Percentage:
      return {
        label: "Split by percentages",
        icon: <CirclePercent className="size-4" />,
      }
    default:
      const exhaustiveCheck: never = type
      throw new Error(`Unhandled type: ${exhaustiveCheck}`)
  }
}

type SplitMethodProps = {
  value: SplitMethodType
  setValue: (value: SplitMethodType) => void
}

export function SplitMethod({ value, setValue }: SplitMethodProps) {
  return (
    <div className="flex flex-col gap-y-2">
      <RadioGroup value={value} onValueChange={setValue}>
        {splitMethodType
          .sort((a, b) => {
            if (a === SplitMethodType.Default) return -1
            if (b === SplitMethodType.Default) return 1
            return a.localeCompare(b)
          })
          .map(t => {
            const { label, icon } = typeToLabelAndIcon(t)

            return (
              <div key={t} className="flex items-center space-x-2">
                <RadioGroupItem value={t} id={t} />
                <Label
                  htmlFor={t}
                  className="flex flex-row items-center gap-x-2"
                >
                  {icon}
                  {label}
                </Label>
              </div>
            )
          })}
      </RadioGroup>
    </div>
  )
}

const expenseSchema = z.object({
  expenseName: z.string().min(1, "Required"),
  amount: z.coerce.number().positive("Must be greater than 0"),
  category: z.string(),
  description: z.string().optional(),
  splitMethod: z.enum(
    [
      SplitMethodType.Amount,
      SplitMethodType.Percentage,
      SplitMethodType.Default,
    ],
    {
      errorMap: () => ({ message: "Required" }),
    }
  ),
  paidByMemberId: z.string().min(1, "Required"),
})

type ExpenseFormValues = z.infer<typeof expenseSchema>

type SplitAmount = {
  memberId: string
  amount: number
}

type SplitState = {
  splitMethod: SplitMethodType
  splitAmounts: SplitAmount[]
}

type Pool = components["schemas"]["PoolDetails"]

export function round(num: number) {
  return Number(num.toFixed(2))
}

export function AddExpenseModal({
  pool,
  isOpen,
  setIsOpen,
}: {
  pool: Pool
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { memberId, createAuthHeader } = useAuth()
  const { mutateAsync: addExpense, isPending } = apiClient.useMutation(
    "post",
    "/api/pools/{pool_id}/expenses"
  )

  const { members, isMembersLoading: isLoading } = usePool({ poolId: pool.id })

  const [splitAmounts, setSplitAmounts] = useState<SplitState>({
    splitMethod: SplitMethodType.Default,
    splitAmounts: members.map(member => ({
      memberId: member.member.id,
      amount: round(100 / members.length),
    })),
  })

  const resetSplitAmounts = useCallback(() => {
    setSplitAmounts({
      splitMethod: SplitMethodType.Default,
      splitAmounts: members.map(member => ({
        memberId: member.member.id,
        amount: round(100 / members.length),
      })),
    })
  }, [members])

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      expenseName: "",
      amount: 0,
      category: "Miscellaneous",
      description: undefined,
      splitMethod: SplitMethodType.Default,
      paidByMemberId: memberId || "",
    },
  })

  const handleUpdateSplitAmounts = useCallback(
    ({
      splitMethod,
      total,
    }: {
      splitMethod: SplitMethodType
      total: number
    }) => {
      if (splitMethod === SplitMethodType.Percentage) {
        setSplitAmounts(() => {
          const newAmounts = members.map(member => ({
            memberId: member.member.id,
            amount: round(100 / members.length),
          }))

          return {
            splitMethod,
            splitAmounts: newAmounts,
          }
        })
      }

      if (splitMethod === SplitMethodType.Amount) {
        setSplitAmounts(() => {
          const newAmounts = members.map(member => ({
            memberId: member.member.id,
            amount: round(total / members.length),
          }))

          return {
            splitMethod,
            splitAmounts: newAmounts,
          }
        })
      }

      if (splitMethod === SplitMethodType.Default) {
        setSplitAmounts(() => {
          const newAmounts = members.map(member => {
            const splitPct = member.pool_membership.default_split_percentage

            return {
              memberId: member.member.id,
              amount: round(splitPct * (total / 100)),
            }
          })

          return {
            splitMethod,
            splitAmounts: newAmounts,
          }
        })
      }
    },
    [members]
  )

  const watchedAmount = form.watch("amount")

  useEffect(() => {
    const splitMethod = form.getValues("splitMethod")

    handleUpdateSplitAmounts({
      splitMethod,
      total: watchedAmount,
    })
  }, [watchedAmount, form, handleUpdateSplitAmounts])

  if (!members.length || isLoading) {
    return null
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={value => {
        setIsOpen(value)
        if (!value) {
          form.reset()
          resetSplitAmounts()
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async data => {
              const memberLineItemAmounts = splitAmounts.splitAmounts.map(a => {
                const member = members.find(m => m.member.id === a.memberId)

                if (!member) {
                  throw new Error(
                    `Member with id ${a.memberId} not found in pool`
                  )
                }

                const amount =
                  splitAmounts.splitMethod === SplitMethodType.Percentage
                    ? (a.amount / 100) * data.amount
                    : splitAmounts.splitMethod === SplitMethodType.Amount
                      ? a.amount
                      : (member.pool_membership.default_split_percentage /
                          100) *
                        data.amount

                return {
                  debtor_member_id: a.memberId,
                  amount,
                }
              })

              const total = memberLineItemAmounts.reduce(
                (acc, item) => acc + item.amount,
                0
              )

              const roundingError = Math.abs(total - data.amount)
              const n = memberLineItemAmounts.length
              const maxRoundingError =
                Math.abs(n * round(data.amount / n) - data.amount) + 0.01

              if (roundingError < maxRoundingError) {
                memberLineItemAmounts.forEach((item, ix) => {
                  if (ix === 0) {
                    item.amount += roundingError
                  }
                })
              }

              if (total !== data.amount && roundingError > maxRoundingError) {
                alert(
                  `Total amount (${data.amount}) does not match split amounts (${total})`
                )
                return
              }

              await addExpense(
                {
                  body: {
                    paid_by_member_id: data.paidByMemberId,
                    pool_id: pool.id,
                    name: data.expenseName,
                    amount: round(data.amount),
                    line_items: memberLineItemAmounts,
                    description: data.description,
                    category: data.category,
                  },
                  params: {
                    path: {
                      pool_id: pool.id,
                    },
                  },
                  headers: createAuthHeader(),
                },
                {
                  onSuccess: async () => {
                    setIsOpen(false)
                    await queryClient.invalidateQueries({
                      queryKey: [
                        "get",
                        "/api/pools/{pool_id}/members/{member_id}/expenses",
                      ],
                    })

                    form.reset()
                    resetSplitAmounts()
                  },
                  onError: error => {
                    console.error("Failed to add expense:", error)
                    alert("Failed to add expense. Please try again.")
                  },
                }
              )
            })}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="expenseName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expense Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Dinner" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Our hotel room in Yosemite"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Amount</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expense Category</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {expenseCategories
                              .sort((a, b) => a.localeCompare(b))
                              .map(c => (
                                <SelectItem
                                  key={c}
                                  value={c}
                                  className="flex items-center gap-x-2"
                                >
                                  <div className="flex items-center gap-x-2">
                                    <ExpenseIcon category={c} />
                                    <span>
                                      {categoryToDisplayName({ category: c })}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="paidByMemberId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Who Paid?</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select who paid" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {members
                            .sort((a, b) => {
                              if (a.member.id === memberId) return -1

                              return a.member.first_name.localeCompare(
                                b.member.first_name
                              )
                            })
                            .map(c => (
                              <SelectItem
                                key={c.member.id}
                                value={c.member.id}
                                className="flex items-center gap-x-2"
                              >
                                <p>{`${c.member.first_name} ${c.member.last_name} ${c.member.id === memberId ? "(Me)" : ""}`}</p>
                              </SelectItem>
                            ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="splitMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Split Method</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-2">
                      <div className="flex flex-col gap-y-2">
                        <SplitMethod
                          value={field.value}
                          setValue={value => {
                            field.onChange(value)

                            handleUpdateSplitAmounts({
                              splitMethod: value,
                              total: form.getValues("amount"),
                            })
                          }}
                        />
                      </div>
                      <div className="border-border flex max-h-40 flex-col gap-y-2 overflow-y-auto rounded-lg border p-4">
                        {members
                          .sort((a, b) =>
                            a.member.first_name
                              .toLowerCase()
                              .localeCompare(b.member.first_name.toLowerCase())
                          )
                          .map(m => (
                            <div className="flex flex-col" key={m.member.email}>
                              <div
                                key={m.member.id}
                                className="flex flex-row items-center justify-between gap-y-4"
                              >
                                <Label
                                  htmlFor={m.member.id}
                                  className="flex flex-row items-center gap-x-2"
                                >
                                  {`${m.member.first_name} ${m.member.last_name} ${m.member.id === memberId ? "(Me)" : ""}`}
                                </Label>
                                <Input
                                  type="number"
                                  value={
                                    splitAmounts.splitAmounts.find(
                                      a => a.memberId == m.member.id
                                    )?.amount
                                  }
                                  onChange={e => {
                                    handleUpdateSplitAmounts({
                                      splitMethod: splitAmounts.splitMethod,
                                      total: parseFloat(e.target.value),
                                    })
                                  }}
                                  className="w-32"
                                />
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isPending}>
              Submit Expense
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
