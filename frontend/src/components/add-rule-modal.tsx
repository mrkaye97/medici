import { errorMessage } from "@/api/client"
import { usePlaceholder } from "@/components/lib/placeholders"
import { useRules } from "@/hooks/use-rules"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import type { components } from "schema"
import { toast } from "sonner"
import { z } from "zod"
import { categoryToDisplayName, expenseCategories } from "./expense-categories"
import { Alert, AlertDescription } from "./ui/alert"
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

  const rulePlaceholder = usePlaceholder("ruleExpression")
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
          <DialogTitle>Create a category rule</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async data => {
              try {
                await createRule(
                  data.rule.trim(),
                  data.category as ExpenseCategory
                )
                toast.success("Rule created")
                setIsOpen(false)
                form.reset()
              } catch (error) {
                form.setError("root.server", {
                  message: errorMessage(
                    error,
                    "Failed to create rule. Please try again."
                  ),
                })
              }
            })}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="rule"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expense names matching (regex)</FormLabel>
                  <FormControl>
                    <Input placeholder={rulePlaceholder} {...field} />
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

            {form.formState.errors.root?.server && (
              <Alert variant="destructive">
                <AlertDescription>
                  {form.formState.errors.root.server.message}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsOpen(false)
                  form.reset()
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreatingRule}>
                {isCreatingRule ? "Creating..." : "Create rule"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
