import { useRules } from "@/hooks/use-rules"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import type { components } from "schema"
import { z } from "zod"
import { categoryToDisplayName, expenseCategories } from "./expense-modals"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"

type ExpenseCategory = components["schemas"]["ExpenseCategory"]

const ruleSchema = z.object({
  rule: z.string().min(1, "Rule is required"),
  category: z.string().min(1, "Category is required"),
})

type RuleFormValues = z.infer<typeof ruleSchema>

export function AddRuleModal({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}) {
  const { createRule, isCreatingRule } = useRules({
    setIsCreating: setIsOpen,
  })

  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      rule: "",
      category: "",
    },
  })

  return (
    <Dialog
      open={isOpen}
      onOpenChange={value => {
        setIsOpen(value)
        if (!value) {
          form.reset()
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Category Rule</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async data => {
              try {
                await createRule(
                  data.rule.trim(),
                  data.category as ExpenseCategory
                )
                setIsOpen(false)
                form.reset()
              } catch (error) {
                console.error("Failed to create rule:", error)
                alert("Failed to create rule. Please try again.")
              }
            })}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="rule"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rule (Supports regex)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Uber, Lyft, taxi, bus"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    Enter the expression that should trigger this category
                  </p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseCategories.map((category: ExpenseCategory) => (
                          <SelectItem key={category} value={category}>
                            {categoryToDisplayName({ category })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isCreatingRule}>
              {isCreatingRule ? "Creating..." : "Create Rule"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
