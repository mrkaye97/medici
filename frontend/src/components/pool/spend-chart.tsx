import {
  categoryToDisplayName,
  ExpenseCategory,
} from "@/components/expense-categories"
import { formatCurrency } from "@/components/lib/format"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { usePool } from "@/hooks/use-pool"
import { useEffect, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

type ChartPayload = {
  name: string
  amount: number
  fill: string
  key: ExpenseCategory | "other"
}

export const SpendChart = ({
  poolId,
  selectedCategory,
  setSelectedCategory,
}: {
  poolId: string
  selectedCategory: ExpenseCategory | undefined
  setSelectedCategory: (category: ExpenseCategory | undefined) => void
}) => {
  const { expenses } = usePool({
    poolId,
  })
  const [numToShow, setNumToShow] = useState(3)

  useEffect(() => {
    const updateNumToShow = () => {
      const width = window.innerWidth
      if (width < 1024) {
        setNumToShow(4)
      } else if (width < 1280) {
        setNumToShow(5)
      } else if (width < 1560) {
        setNumToShow(6)
      } else {
        setNumToShow(7)
      }
    }

    updateNumToShow()
    window.addEventListener("resize", updateNumToShow)

    return () => window.removeEventListener("resize", updateNumToShow)
  }, [])

  const expenseSummary: ChartPayload[] = useMemo(() => {
    // Payments between members aren't spending, so leave them out.
    const agg = expenses.reduce(
      (acc, expense) => {
        if (expense.is_payment) {
          return acc
        }

        const category = expense.category

        if (!acc[category]) {
          acc[category] = 0
        }

        acc[category] += expense.amount

        return acc
      },
      {} as Record<ExpenseCategory, number>
    )

    const entries = Object.entries(agg)
      .map(([category, amount]) => ({
        name: categoryToDisplayName({ category: category as ExpenseCategory }),
        amount,
        key: category as ExpenseCategory,
      }))
      .sort((a, b) => b.amount - a.amount)

    const withOtherCategory = [
      ...entries.slice(0, numToShow - 1),
      {
        name: "Other",
        amount: entries
          .slice(numToShow - 1)
          .reduce((sum, entry) => sum + entry.amount, 0),
        key: "other" as ExpenseCategory | "other",
      },
    ].filter(entry => entry.amount > 0)

    const maxAmount = Math.max(...withOtherCategory.map(e => e.amount))
    const minAmount = Math.min(...withOtherCategory.map(e => e.amount))

    return withOtherCategory.map(entry => {
      const intensity =
        withOtherCategory.length > 1
          ? (entry.amount - minAmount) / (maxAmount - minAmount)
          : 0.5

      const getGreenShade = (intensity: number) => {
        const lightness = 0.72 - intensity * 0.32
        const chroma = 0.055 + intensity * 0.035

        return `oklch(${lightness} ${chroma} 155)`
      }

      return {
        ...entry,
        fill: getGreenShade(intensity),
      }
    })
  }, [expenses, numToShow])

  const chartConfig = {
    amount: {
      label: "Amount",
      color: "var(--primary)",
    },
  } satisfies ChartConfig

  if (expenseSummary.length === 0) {
    return (
      <div>
        <h3 className="text-foreground flex items-center gap-2 font-semibold">
          Spend Summary
        </h3>
        <div className="text-muted-foreground mt-4">
          No expenses to display. Add some expenses to see your spending
          summary.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-foreground flex items-center gap-2 font-semibold">
        Spend Summary
      </h3>
      <div>
        <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
          <BarChart
            accessibilityLayer
            data={expenseSummary}
            onClick={e => {
              const payload: ChartPayload | undefined =
                e.activePayload?.at(0)?.payload

              if (
                !payload ||
                payload.key == "other" ||
                payload.key === selectedCategory
              ) {
                setSelectedCategory(undefined)
                return
              }

              setSelectedCategory(payload.key)
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={false}
              tickMargin={6}
              axisLine={false}
              tick={{ fontSize: 10 }}
              interval={0}
            />
            <ChartTooltip
              content={<ChartTooltipContent />}
              labelClassName="flex flex-row ml-8 items-center"
              formatter={(value, name, payload) => {
                return (
                  <div className="flex flex-row items-center justify-between w-full px-1 gap-x-2">
                    <div className="flex flex-row gap-x-1 items-center">
                      <span
                        className="border-foreground/40 inline-block size-2 border align-middle"
                        style={{ backgroundColor: payload.payload.fill }}
                      ></span>
                      <span className="capitalize font-semibold">{name}</span>
                    </div>
                    <span>{formatCurrency(value as number)}</span>
                  </div>
                )
              }}
            />
            <Bar
              dataKey="amount"
              radius={[4, 4, 0, 0]}
              className="hover:cursor-pointer"
            />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  )
}
