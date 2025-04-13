import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTRPC } from "~/trpc/react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { ListPoolsForMemberRow } from "~/server/src/db/query_sql";

const expenseSchema = z.object({
  name: z.string().min(1, "Required"),
  amount: z.coerce.number().positive("Must be greater than 0"),
  lineItemAmount: z.coerce.number().positive("Must be greater than 0"),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

export function AddExpenseModal({
  pool,
  isOpen,
  setIsOpen,
}: {
  pool: ListPoolsForMemberRow;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}) {
  const trpc = useTRPC();
  const { mutate: addExpense } = useMutation(trpc.addExpense.mutationOptions());

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      name: "",
      amount: 0,
      lineItemAmount: 0,
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => {
              addExpense(
                {
                  paidByMemberId: pool.memberId,
                  poolId: pool.id,
                  name: data.name,
                  amount: data.amount,
                  lineItems: [
                    {
                      debtor_member_id: pool.memberId, // Can be made dynamic later
                      amount: data.lineItemAmount,
                    },
                  ],
                },
                {
                  onSuccess: () => setIsOpen(false),
                  onError: (err) =>
                    alert("Failed to add expense: " + err.message),
                }
              );
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Dinner" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
              name="lineItemAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Line Item Amount</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit">Submit Expense</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
