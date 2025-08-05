import { apiClient } from "@/api/client"
import { useAuth } from "@/hooks/use-auth"
import { usePool } from "@/hooks/use-pool"
import { useRules } from "@/hooks/use-rules"
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
import { components, paths } from "schema"
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

type SplitMethod = components["schemas"]["SplitMethod"]
const splitMethods = ["Default", "Amount", "Percentage"] as SplitMethod[]

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

function typeToLabelAndIcon(type: SplitMethod) {
  switch (type) {
    case "Default":
      return {
        label: "Split by default",
        icon: <Pin className="size-4" />,
      }
    case "Amount":
      return {
        label: "Split by dollar amounts",
        icon: <CircleDollarSign className="size-4" />,
      }
    case "Percentage":
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
  value: SplitMethod
  setValue: (value: SplitMethod) => void
}

export function SplitMethod({ value, setValue }: SplitMethodProps) {
  return (
    <div className="flex flex-col gap-y-2">
      <RadioGroup value={value} onValueChange={setValue}>
        {splitMethods
          .sort((a, b) => {
            if (a === "Default") return -1
            if (b === "Default") return 1
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
  category: z.enum([
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
  ]),
  description: z.string().optional(),
  splitMethod: z.enum(["Amount", "Percentage", "Default"], {
    errorMap: () => ({ message: "Required" }),
  }),
  paidByMemberId: z.string().min(1, "Required"),
})

type ExpenseFormValues = z.infer<typeof expenseSchema>

type SplitAmount = {
  memberId: string
  amount: number
}

type SplitState = {
  splitMethod: SplitMethod
  splitAmounts: SplitAmount[]
}

type Pool = components["schemas"]["PoolDetails"]

type Members =
  paths["/api/members/{member_id}/pools/{pool_id}/members"]["get"]["responses"]["200"]["content"]["application/json"]

export function round(num: number) {
  return Number(num.toFixed(2))
}

export function BaseExpenseModal({
  pool,
  isOpen,
  setIsOpen,
  onSubmit,
  isSubmitPending,
  defaultValues,
  title = "Add Expense",
  defaultSplitAmounts,
}: {
  pool: Pool
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  onSubmit: (
    formData: ExpenseFormValues,
    splitAmounts: SplitState,
    members: Members
  ) => Promise<{ success: boolean; error?: string }>
  isSubmitPending: boolean
  defaultValues?: ExpenseFormValues
  title?: string
  defaultSplitAmounts?: SplitState
}) {
  const { memberId } = useAuth()
  const { members, isMembersLoading: isLoading } = usePool({ poolId: pool.id })
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { autoCategorizeName } = useRules()

  const [splitAmounts, setSplitAmounts] = useState<SplitState>(
    defaultSplitAmounts || {
      splitMethod: "Default",
      splitAmounts: members.map(member => ({
        memberId: member.member.id,
        amount: round(100 / members.length),
      })),
    }
  )

  const resetSplitAmounts = useCallback(() => {
    setSplitAmounts(
      defaultSplitAmounts || {
        splitMethod: "Default",
        splitAmounts: members.map(member => ({
          memberId: member.member.id,
          amount: round(100 / members.length),
        })),
      }
    )
  }, [members, defaultSplitAmounts])

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: defaultValues || {
      expenseName: "",
      amount: 0,
      category: "Miscellaneous",
      description: undefined,
      splitMethod: "Default",
      paidByMemberId: memberId || "",
    },
  })

  const watchedAmount = form.watch("amount")
  const watchedExpenseName = form.watch("expenseName")

  useEffect(() => {
    if (
      !defaultValues &&
      watchedExpenseName &&
      form.getValues("category") === "Miscellaneous"
    ) {
      const suggestedCategory = autoCategorizeName(watchedExpenseName)
      if (suggestedCategory) {
        form.setValue("category", suggestedCategory)
      }
    }
  }, [watchedExpenseName, autoCategorizeName, form, defaultValues])

  const handleUpdateSplitAmounts = useCallback(
    ({ splitMethod, total }: { splitMethod: SplitMethod; total: number }) => {
      if (splitMethod === "Percentage") {
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

      if (splitMethod === "Amount") {
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

      if (splitMethod === "Default") {
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
          setSubmitError(null)
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async data => {
              setSubmitError(null)
              const result = await onSubmit(data, splitAmounts, members)

              if (result.success) {
                setIsOpen(false)
                resetSplitAmounts()
                form.reset()
              } else {
                setSubmitError(result.error || "An unexpected error occurred")
              }
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
                                      a => a.memberId === m.member.id
                                    )?.amount
                                  }
                                  onChange={e => {
                                    const newAmount =
                                      parseFloat(e.target.value) || 0
                                    setSplitAmounts(prev => ({
                                      ...prev,
                                      splitAmounts: prev.splitAmounts.map(
                                        split =>
                                          split.memberId === m.member.id
                                            ? { ...split, amount: newAmount }
                                            : split
                                      ),
                                    }))
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

            {submitError && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{submitError}</div>
              </div>
            )}

            <Button type="submit" disabled={isSubmitPending}>
              Submit Expense
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
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
  const { createAuthHeader } = useAuth()
  const queryClient = useQueryClient()
  const { mutateAsync: addExpense, isPending } = apiClient.useMutation(
    "post",
    "/api/pools/{pool_id}/expenses"
  )

  const onSubmit = useCallback(
    async (
      data: ExpenseFormValues,
      splitAmounts: SplitState,
      members: Members
    ): Promise<{ success: boolean; error?: string }> => {
      const memberLineItemAmounts = splitAmounts.splitAmounts.map(a => {
        const member = members.find(m => m.member.id === a.memberId)

        if (!member) {
          throw new Error(`Member with id ${a.memberId} not found in pool`)
        }

        const amount =
          splitAmounts.splitMethod === "Percentage"
            ? (a.amount / 100) * data.amount
            : splitAmounts.splitMethod === "Amount"
              ? a.amount
              : (member.pool_membership.default_split_percentage / 100) *
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
        return {
          success: false,
          error: `Total amount (${data.amount}) does not match split amounts (${total})`,
        }
      }

      try {
        await addExpense({
          body: {
            paid_by_member_id: data.paidByMemberId,
            pool_id: pool.id,
            name: data.expenseName,
            amount: round(data.amount),
            line_items: memberLineItemAmounts,
            description: data.description,
            category: data.category,
            split_method: data.splitMethod,
          },
          params: {
            path: {
              pool_id: pool.id,
            },
          },
          headers: createAuthHeader(),
        })

        await queryClient.invalidateQueries({
          queryKey: [
            "get",
            "/api/pools/{pool_id}/members/{member_id}/expenses",
          ],
        })

        return { success: true }
      } catch (error) {
        console.error("Failed to add expense:", error)
        return {
          success: false,
          error: "Failed to add expense. Please try again.",
        }
      }
    },
    [addExpense, pool.id, queryClient, createAuthHeader]
  )

  return (
    <BaseExpenseModal
      pool={pool}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      onSubmit={onSubmit}
      isSubmitPending={isPending}
    />
  )
}

export function UpdateExpenseModal({
  pool,
  expenseId,
  isOpen,
  setIsOpen,
}: {
  pool: Pool
  expenseId: string
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}) {
  const { createAuthHeader, memberId } = useAuth()
  const queryClient = useQueryClient()

  const { data: expense, isLoading } = apiClient.useQuery(
    "get",
    "/api/members/{member_id}/pools/{pool_id}/expenses/{expense_id}",
    {
      params: {
        path: {
          member_id: memberId || "",
          pool_id: pool.id,
          expense_id: expenseId,
        },
      },
      headers: createAuthHeader(),
    },
    {
      enabled: !!memberId && isOpen,
    }
  )
  const { mutateAsync: updateExpense, isPending } = apiClient.useMutation(
    "patch",
    "/api/pools/{pool_id}/expenses/{expense_id}"
  )

  const onSubmit = useCallback(
    async (
      data: ExpenseFormValues,
      splitAmounts: SplitState,
      members: Members
    ): Promise<{ success: boolean; error?: string }> => {
      const memberLineItemAmounts = splitAmounts.splitAmounts.map(a => {
        const member = members.find(m => m.member.id === a.memberId)

        if (!member) {
          throw new Error(`Member with id ${a.memberId} not found in pool`)
        }

        const amount =
          splitAmounts.splitMethod === "Percentage"
            ? (a.amount / 100) * data.amount
            : splitAmounts.splitMethod === "Amount"
              ? a.amount
              : (member.pool_membership.default_split_percentage / 100) *
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
        return {
          success: false,
          error: `Total amount (${data.amount}) does not match split amounts (${total})`,
        }
      }

      try {
        await updateExpense({
          body: {
            name: data.expenseName,
            amount: round(data.amount),
            line_items: memberLineItemAmounts,
            description: data.description,
            category: data.category,
            split_method: data.splitMethod,
          },
          params: {
            path: {
              pool_id: pool.id,
              expense_id: expenseId,
            },
          },
          headers: createAuthHeader(),
        })

        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: [
              "get",
              "/api/pools/{pool_id}/members/{member_id}/expenses",
            ],
          }),
          queryClient.invalidateQueries({
            queryKey: [
              "get",
              "/api/members/{member_id}/pools/{pool_id}/expenses/{expense_id}",
            ],
          }),
        ])

        return { success: true }
      } catch (error) {
        console.error("Failed to update expense:", error)
        return {
          success: false,
          error: "Failed to update expense. Please try again.",
        }
      }
    },
    [updateExpense, pool.id, queryClient, createAuthHeader, expenseId]
  )

  if (isLoading || !expense) {
    return null
  }

  const defaultSplitAmounts: SplitState = {
    splitMethod: expense.split_method,
    splitAmounts: expense.line_items.map(lineItem => ({
      memberId: lineItem.debtor_member_id,
      amount:
        expense.split_method === "Percentage"
          ? round((lineItem.amount / expense.amount) * 100)
          : lineItem.amount,
    })),
  }

  return (
    <BaseExpenseModal
      pool={pool}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      onSubmit={onSubmit}
      isSubmitPending={isPending}
      defaultValues={{
        amount: expense.amount,
        category: expense.category,
        description: expense.description || "",
        expenseName: expense.name,
        paidByMemberId: expense.paid_by_member_id,
        splitMethod: expense.split_method,
      }}
      defaultSplitAmounts={defaultSplitAmounts}
      title="Update Expense"
    />
  )
}
