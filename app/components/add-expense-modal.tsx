import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTRPC } from "../../trpc/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { CircleDollarSign, CirclePercent } from "lucide-react";
import { useState } from "react";
import { Separator } from "./ui/separator";
import { ListPoolsForMemberRow } from "../../backend/src/db/query_sql";
import { useAuth } from "../hooks/auth";

enum SplitMethodType {
  Percentage = "percentage",
  Amount = "amount",
}

const splitMethodType = Object.values(SplitMethodType);

function typeToLabelAndIcon(type: SplitMethodType) {
  switch (type) {
    case SplitMethodType.Amount:
      return {
        label: "Split by dollar amounts",
        icon: <CircleDollarSign className="size-4" />,
      };
    case SplitMethodType.Percentage:
      return {
        label: "Split by percentages",
        icon: <CirclePercent className="size-4" />,
      };
    default:
      // eslint-disable-next-line no-case-declarations
      const exhaustiveCheck: never = type;
      throw new Error(`Unhandled type: ${exhaustiveCheck}`);
  }
}

type SplitMethodProps = {
  value: SplitMethodType;
  setValue: (value: SplitMethodType) => void;
};

export function SplitMethod({ value, setValue }: SplitMethodProps) {
  return (
    <div className="flex flex-col gap-y-2">
      <RadioGroup value={value} onValueChange={setValue}>
        {splitMethodType.map((t) => {
          const { label, icon } = typeToLabelAndIcon(t);

          return (
            <div key={t} className="flex items-center space-x-2">
              <RadioGroupItem value={t} id={t} />
              <Label htmlFor={t} className="flex flex-row items-center gap-x-2">
                {icon}
                {label}
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
}

const expenseSchema = z.object({
  expenseName: z.string().min(1, "Required"),
  amount: z.coerce.number().positive("Must be greater than 0"),
  splitMethod: z.enum([SplitMethodType.Amount, SplitMethodType.Percentage], {
    errorMap: () => ({ message: "Required" }),
  }),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

type SplitAmount = {
  memberId: string;
  amount: number;
};

type SplitState = {
  splitMethod: SplitMethodType;
  splitAmounts: SplitAmount[];
};

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
  const queryClient = useQueryClient();
  const { id } = useAuth();
  const { mutate: addExpense } = useMutation(trpc.addExpense.mutationOptions());
  const { data } = useQuery(trpc.listMembersOfPool.queryOptions(pool.id));
  const members = data ?? [];
  const [splitAmounts, setSplitAmounts] = useState<SplitState>({
    splitMethod: SplitMethodType.Percentage,
    splitAmounts: members.map((member) => ({
      memberId: member.id,
      amount: 100 / members.length,
    })),
  });

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      expenseName: "",
      amount: 0,
      splitMethod: SplitMethodType.Percentage,
    },
  });

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(value) => {
        setIsOpen(value);
        if (!value) {
          form.reset();
        }
      }}
    >
      <DialogContent className="ml-32">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => {
              const memberLineItemAmounts = splitAmounts.splitAmounts.map(
                (a) => {
                  const amount =
                    splitAmounts.splitMethod === SplitMethodType.Percentage
                      ? (a.amount / 100) * data.amount
                      : a.amount;

                  return {
                    debtor_member_id: a.memberId,
                    amount,
                  };
                }
              );

              const total = memberLineItemAmounts.reduce(
                (acc, item) => acc + item.amount,
                0
              );

              if (total !== data.amount) {
                alert(
                  `Total amount (${data.amount}) does not match split amounts (${total})`
                );
                return;
              }

              addExpense(
                {
                  paidByMemberId: id || "",
                  poolId: pool.id,
                  name: data.expenseName,
                  amount: data.amount,
                  lineItems: memberLineItemAmounts,
                },
                {
                  onSuccess: async () => {
                    setIsOpen(false);
                    await queryClient.invalidateQueries({
                      queryKey: trpc.getPoolRecentExpenses.queryKey(),
                    });

                    form.reset();
                  },
                  onError: (err) =>
                    alert("Failed to add expense: " + err.message),
                }
              );
            })}
            className="space-y-4"
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
              name="splitMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Split Method</FormLabel>
                  <FormControl>
                    <div className="flex flex-col gap-y-2">
                      <SplitMethod
                        value={field.value}
                        setValue={(value) => {
                          field.onChange(value);

                          setSplitAmounts(() => {
                            const newAmounts =
                              value === SplitMethodType.Percentage
                                ? members.map((member) => ({
                                    memberId: member.id,
                                    amount: 100 / members.length,
                                  }))
                                : members.map((member) => ({
                                    memberId: member.id,
                                    amount:
                                      form.getValues("amount") / members.length,
                                  }));

                            return {
                              splitMethod: value,
                              splitAmounts: newAmounts,
                            };
                          });
                        }}
                      />
                      <div className="flex flex-col gap-y-2 border border-[#00000025] p-4 rounded-lg mt-4">
                        {members.map((m, ix) => (
                          <div className="flex flex-col" key={m.email}>
                            <div
                              key={m.id}
                              className="flex flex-row gap-y-2 justify-between items-center"
                            >
                              <Label
                                htmlFor={m.id}
                                className="flex flex-row items-center gap-x-2"
                              >
                                {m.firstName}
                              </Label>
                              <Input
                                type="number"
                                value={
                                  splitAmounts.splitAmounts.find(
                                    (a) => a.memberId == m.id
                                  )?.amount
                                }
                                onChange={(e) => {
                                  const memberId = m.id;

                                  setSplitAmounts((prev) => {
                                    const newAmounts = prev.splitAmounts.map(
                                      (a) => {
                                        if (a.memberId === memberId) {
                                          return {
                                            ...a,
                                            amount: parseFloat(e.target.value),
                                          };
                                        }
                                        return a;
                                      }
                                    );

                                    return {
                                      ...prev,
                                      splitAmounts: newAmounts,
                                    };
                                  });
                                }}
                                className="w-32"
                              />
                            </div>
                            {ix !== members.length - 1 && (
                              <Separator className="my-4" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
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
