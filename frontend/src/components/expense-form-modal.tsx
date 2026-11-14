import { formatCurrency, initials, round } from "@/components/lib/format"
import { cn } from "@/components/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/hooks/use-auth"
import { usePool } from "@/hooks/use-pool"
import { useRules } from "@/hooks/use-rules"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus } from "lucide-react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form"
import { Input } from "./ui/input"
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

const splitMethodOptions: {
  value: SplitMethod
  label: string
  help: string
}[] = [
  {
    value: "Default",
    label: "Default",
    help: "Uses the pool's default split.",
  },
  { value: "Amount", label: "Amounts", help: "Enter what each person owes." },
  {
    value: "Percentage",
    label: "Percent",
    help: "Enter each person's share in percent.",
  },
]

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
  title = "Add expense",
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
  const [showNote, setShowNote] = useState(!!defaultValues?.description)
  const { autoCategorizeName } = useRules()

  /** Everyone equal (Amount/Percentage), or the pool default (Default).
   * Equal shares are in whole cents (or hundredths of a percent) with any
   * leftover on the first person, so they add up exactly. */
  const freshSplit = useCallback(
    (splitMethod: SplitMethod, total: number): SplitState => {
      const whole = Math.round(
        (splitMethod === "Percentage" ? 100 : total) * 100
      )
      const each = Math.floor(whole / members.length)
      const leftover = whole - each * members.length
      return {
        splitMethod,
        splitAmounts: members.map((m, i) => ({
          memberId: m.member.id,
          amount:
            splitMethod === "Default"
              ? m.pool_membership.default_split_percentage
              : (each + (i === 0 ? leftover : 0)) / 100,
        })),
      }
    },
    [members]
  )

  const [split, setSplit] = useState<SplitState>(
    () => defaultSplitAmounts ?? freshSplit("Default", 0)
  )
  // What's typed in each split box, so "12." survives until the next digit.
  const [splitText, setSplitText] = useState<Record<string, string>>({})

  // Members can arrive after the first render.
  useEffect(() => {
    if (members.length > 0 && split.splitAmounts.length === 0) {
      setSplit(defaultSplitAmounts ?? freshSplit("Default", 0))
    }
  }, [members, split.splitAmounts.length, defaultSplitAmounts, freshSplit])

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: defaultValues || {
      expenseName: "",
      // Empty rather than "0", so you can type straight away.
      amount: "" as unknown as number,
      category: "Miscellaneous",
      description: undefined,
      splitMethod: "Default",
      paidByMemberId: memberId || "",
    },
  })

  const watchedExpenseName = form.watch("expenseName")
  const total = Number(form.watch("amount")) || 0

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

  const reset = () => {
    form.reset()
    setSplit(defaultSplitAmounts ?? freshSplit("Default", 0))
    setSplitText({})
    setShowNote(!!defaultValues?.description)
    setSubmitError(null)
  }

  if (!members.length || isLoading) {
    return null
  }

  const sortedMembers = [...members].sort((a, b) =>
    a.member.id === memberId
      ? -1
      : b.member.id === memberId
        ? 1
        : a.member.first_name.localeCompare(b.member.first_name)
  )
  const nameOf = (m: Members[number]) =>
    m.member.id === memberId
      ? `${m.member.first_name} (you)`
      : `${m.member.first_name} ${m.member.last_name}`

  const method = split.splitMethod
  const valueFor = (id: string) =>
    split.splitAmounts.find(a => a.memberId === id)?.amount ?? 0
  const assigned = split.splitAmounts.reduce((sum, a) => sum + a.amount, 0)
  const target = method === "Percentage" ? 100 : total
  const remaining = round(target - assigned)
  const format = (n: number) =>
    method === "Percentage" ? `${round(n)}%` : formatCurrency(n)

  return (
    <Dialog
      open={isOpen}
      onOpenChange={value => {
        setIsOpen(value)
        if (!value) {
          reset()
        }
      }}
    >
      <DialogContent className="max-h-[90dvh] max-w-lg gap-0 overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{pool.name}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="expense-form"
            onSubmit={form.handleSubmit(async data => {
              setSubmitError(null)
              const result = await onSubmit(data, split, members)

              if (result.success) {
                setIsOpen(false)
                reset()
              } else {
                setSubmitError(result.error || "An unexpected error occurred")
              }
            })}
            className="space-y-5 px-6 py-4"
          >
            <FormField
              control={form.control}
              name="expenseName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What was it for?</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Dinner out"
                      autoFocus={!defaultValues}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
                          $
                        </span>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          className="[appearance:textfield] pl-7 text-base font-semibold tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          {...field}
                          onChange={e => {
                            field.onChange(e)
                            // Even amounts follow the new total; percentages
                            // and the default split don't depend on it.
                            if (method === "Amount") {
                              setSplit(
                                freshSplit(
                                  "Amount",
                                  Number(e.target.value) || 0
                                )
                              )
                              setSplitText({})
                            }
                          }}
                        />
                      </div>
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
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          {expenseCategories.map(c => (
                            <SelectItem key={c} value={c}>
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
                  <FormLabel>Paid by</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select who paid" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        {sortedMembers.map(m => (
                          <SelectItem key={m.member.id} value={m.member.id}>
                            {nameOf(m)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="splitMethod"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-3">
                    <FormLabel>Split</FormLabel>
                    <div
                      role="radiogroup"
                      aria-label="How to split"
                      className="bg-muted inline-flex rounded-lg p-0.5"
                    >
                      {splitMethodOptions.map(option => (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={field.value === option.value}
                          className={cn(
                            "rounded-md px-3 py-1 text-xs font-medium transition-colors hover:cursor-pointer",
                            field.value === option.value
                              ? "bg-card text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                          onClick={() => {
                            field.onChange(option.value)
                            setSplit(freshSplit(option.value, total))
                            setSplitText({})
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {splitMethodOptions.find(o => o.value === method)?.help}
                  </p>

                  <div className="divide-y rounded-lg border">
                    {sortedMembers.map(m => {
                      const id = m.member.id
                      const pct = m.pool_membership.default_split_percentage
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-3 px-3 py-2"
                        >
                          <span className="bg-secondary text-secondary-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
                            {initials(m.member.first_name, m.member.last_name)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {nameOf(m)}
                          </span>
                          {method === "Default" ? (
                            <span className="text-muted-foreground text-sm tabular-nums">
                              {pct}%
                              <span className="text-foreground ml-3 inline-block w-20 text-right font-medium">
                                {formatCurrency((pct / 100) * total)}
                              </span>
                            </span>
                          ) : (
                            <div className="relative w-28">
                              {method === "Amount" && (
                                <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm">
                                  $
                                </span>
                              )}
                              <Input
                                aria-label={`${nameOf(m)}'s share`}
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                className={cn(
                                  "h-8 [appearance:textfield] text-right tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                                  method === "Amount" ? "pl-6" : "pr-7"
                                )}
                                value={splitText[id] ?? String(valueFor(id))}
                                onChange={e => {
                                  const text = e.target.value
                                  setSplitText(prev => ({
                                    ...prev,
                                    [id]: text,
                                  }))
                                  setSplit(prev => ({
                                    ...prev,
                                    splitAmounts: prev.splitAmounts.map(a =>
                                      a.memberId === id
                                        ? { ...a, amount: Number(text) || 0 }
                                        : a
                                    ),
                                  }))
                                }}
                              />
                              {method === "Percentage" && (
                                <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm">
                                  %
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {method !== "Default" && (
                      <div
                        className={cn(
                          "flex items-center justify-between px-3 py-2 text-xs font-medium",
                          Math.abs(remaining) < 0.01
                            ? "text-success"
                            : "text-owe"
                        )}
                      >
                        <span>
                          {format(assigned)} of {format(target)}
                        </span>
                        <span>
                          {Math.abs(remaining) < 0.01
                            ? "Adds up"
                            : remaining > 0
                              ? `${format(remaining)} left`
                              : `${format(-remaining)} over`}
                        </span>
                      </div>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showNote ? (
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Our hotel room in Yosemite"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm hover:cursor-pointer"
                onClick={() => setShowNote(true)}
              >
                <Plus className="size-3.5" />
                Add a note
              </button>
            )}

            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}
          </form>
        </Form>

        <div className="bg-background sticky bottom-0 flex justify-end gap-2 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setIsOpen(false)
              reset()
            }}
          >
            Cancel
          </Button>
          <Button type="submit" form="expense-form" disabled={isSubmitPending}>
            {isSubmitPending ? "Saving..." : submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
