import { round } from "@/components/lib/format"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/hooks/use-auth"
import { usePool } from "@/hooks/use-pool"
import { useRules } from "@/hooks/use-rules"
import { zodResolver } from "@hookform/resolvers/zod"
import { CircleDollarSign, CirclePercent, Pin } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { components, paths } from "schema"
import { z } from "zod"
import {
  categoryToDisplayName,
  expenseCategories,
  ExpenseCategory,
  ExpenseIcon,
} from "./expense-categories"
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
// Default first, then alphabetical.
const splitMethods: SplitMethod[] = ["Default", "Amount", "Percentage"]

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

function SplitMethodPicker({ value, setValue }: SplitMethodProps) {
  return (
    <div className="flex flex-col gap-y-2">
      <RadioGroup value={value} onValueChange={setValue}>
        {splitMethods.map(t => {
          const { label, icon } = typeToLabelAndIcon(t)

          return (
            <div key={t} className="flex items-center space-x-2">
              <RadioGroupItem value={t} id={t} />
              <Label htmlFor={t} className="flex flex-row items-center gap-x-2">
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
  expenseName: z.string().trim().min(1, "Required"),
  amount: z.coerce.number().positive("Must be greater than 0"),
  category: z.enum(
    expenseCategories as [ExpenseCategory, ...ExpenseCategory[]]
  ),
  description: z.string().optional(),
  splitMethod: z.enum(["Amount", "Percentage", "Default"], {
    errorMap: () => ({ message: "Required" }),
  }),
  paidByMemberId: z.string().min(1, "Required"),
})

export type ExpenseFormValues = z.infer<typeof expenseSchema>

type SplitAmount = {
  memberId: string
  amount: number
}

export type SplitState = {
  splitMethod: SplitMethod
  splitAmounts: SplitAmount[]
}

export type Pool = components["schemas"]["PoolDetails"]

export type Members =
  paths["/api/pools/{pool_id}/members"]["get"]["responses"]["200"]["content"]["application/json"]

export type LineItem = { debtor_member_id: string; amount: number }

/**
 * Turn the form's split into per-member amounts. Small rounding leftovers
 * (from e.g. thirds) go to the first member so the line items add up to the
 * total; anything bigger is reported as an error instead.
 */
export function buildLineItems(
  data: ExpenseFormValues,
  split: SplitState,
  members: Members
): { lineItems: LineItem[] } | { error: string } {
  const lineItems: LineItem[] = []

  for (const a of split.splitAmounts) {
    const member = members.find(m => m.member.id === a.memberId)
    if (!member) {
      return { error: "Someone in this split is no longer in the pool" }
    }

    const amount =
      split.splitMethod === "Percentage"
        ? (a.amount / 100) * data.amount
        : split.splitMethod === "Amount"
          ? a.amount
          : (member.pool_membership.default_split_percentage / 100) *
            data.amount

    lineItems.push({ debtor_member_id: a.memberId, amount })
  }

  const total = lineItems.reduce((acc, item) => acc + item.amount, 0)
  const difference = data.amount - total
  const n = lineItems.length
  const maxRoundingError =
    Math.abs(n * round(data.amount / n) - data.amount) + 0.01

  if (Math.abs(difference) > maxRoundingError) {
    return {
      error: `The split adds up to ${round(total)}, but the total is ${round(data.amount)}`,
    }
  }

  if (lineItems.length > 0) {
    lineItems[0].amount += difference
  }

  return { lineItems }
}

export function ExpenseFormModal({
  pool,
  isOpen,
  setIsOpen,
  onSubmit,
  isSubmitPending,
  defaultValues,
  title = "Add Expense",
  submitLabel = "Add expense",
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
  submitLabel?: string
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
                            {expenseCategories.map(c => (
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
                          {[...members]
                            .sort((a, b) => {
                              if (a.member.id === memberId) return -1
                              if (b.member.id === memberId) return 1

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
                        <SplitMethodPicker
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
                        {[...members]
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
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={isSubmitPending}
              className="w-full sm:w-auto"
            >
              {isSubmitPending ? "Saving..." : submitLabel}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
