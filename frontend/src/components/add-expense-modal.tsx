import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import {
  Utensils,
  ShoppingCart,
  ShoppingBag,
  Car,
  Home,
  Plug,
  Stethoscope,
  Tv,
  GraduationCap,
  Plane,
  Bath,
  Dumbbell,
  CreditCard,
  Receipt,
  Briefcase,
  TrendingUp,
  Shield,
  Gift,
  HelpingHand,
  Ellipsis,
  Pin,
} from "lucide-react";
import { Input } from "./ui/input";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { CircleDollarSign, CirclePercent } from "lucide-react";
import { useCallback, useState } from "react";
import { Separator } from "./ui/separator";
import { useAuth } from "@/hooks/use-auth";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";
import { apiClient } from "@/api/client";
import { components } from "schema";
import { usePool } from "@/hooks/use-pool";

enum SplitMethodType {
  Percentage = "percentage",
  Amount = "amount",
  Default = "default",
}

export type ExpenseCategory = components["schemas"]["ExpenseCategory"];

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
];

export const categoryToIcon = ({
  category,
  size = 4,
}: {
  category: ExpenseCategory;
  size?: number;
}) => {
  switch (category) {
    case "FoodDining":
      return <Utensils className={`size-${size}`} />;
    case "Groceries":
      return <ShoppingCart className={`size-${size}`} />;
    case "Transportation":
      return <Car className={`size-${size}`} />;
    case "HousingRent":
      return <Home className={`size-${size}`} />;
    case "Utilities":
      return <Plug className={`size-${size}`} />;
    case "Healthcare":
      return <Stethoscope className={`size-${size}`} />;
    case "Entertainment":
      return <Tv className={`size-${size}`} />;
    case "Shopping":
      return <ShoppingBag className={`size-${size}`} />;
    case "Education":
      return <GraduationCap className={`size-${size}`} />;
    case "Travel":
      return <Plane className={`size-${size}`} />;
    case "PersonalCare":
      return <Bath className={`size-${size}`} />;
    case "Fitness":
      return <Dumbbell className={`size-${size}`} />;
    case "Subscriptions":
      return <CreditCard className={`size-${size}`} />;
    case "BillsPayments":
      return <Receipt className={`size-${size}`} />;
    case "BusinessExpenses":
      return <Briefcase className={`size-${size}`} />;
    case "Investments":
      return <TrendingUp className={`size-${size}`} />;
    case "Insurance":
      return <Shield className={`size-${size}`} />;
    case "Gifts":
      return <Gift className={`size-${size}`} />;
    case "Charity":
      return <HelpingHand className={`size-${size}`} />;
    case "Miscellaneous":
      return <Ellipsis className={`size-${size}`} />;
    default:
      const exhaustiveCheck: never = category;
      throw new Error(`Unhandled category: ${exhaustiveCheck}`);
  }
};

export const categoryToDisplayName = ({
  category,
}: {
  category: ExpenseCategory;
}) => {
  switch (category) {
    case "FoodDining":
      return "Food & Dining";
    case "Groceries":
      return "Groceries";
    case "Transportation":
      return "Transportation";
    case "HousingRent":
      return "Housing & Rent";
    case "Utilities":
      return "Utilities";
    case "Healthcare":
      return "Healthcare";
    case "Entertainment":
      return "Entertainment";
    case "Shopping":
      return "Shopping";
    case "Education":
      return "Education";
    case "Travel":
      return "Travel";
    case "PersonalCare":
      return "Personal Care";
    case "Fitness":
      return "Fitness";
    case "Subscriptions":
      return "Subscriptions";
    case "BillsPayments":
      return "Bills & Payments";
    case "BusinessExpenses":
      return "Business Expenses";
    case "Investments":
      return "Investments";
    case "Insurance":
      return "Insurance";
    case "Gifts":
      return "Gifts";
    case "Charity":
      return "Charity";
    case "Miscellaneous":
      return "Miscellaneous";
    default:
      const exhaustiveCheck: never = category;
      throw new Error(`Unhandled category: ${exhaustiveCheck}`);
  }
};

export const ExpenseIcon = ({
  category,
  size = 4,
}: {
  category: ExpenseCategory;
  size?: number;
}) => {
  return categoryToIcon({ category, size });
};

const splitMethodType = Object.values(SplitMethodType);

function typeToLabelAndIcon(type: SplitMethodType) {
  switch (type) {
    case SplitMethodType.Default:
      return {
        label: "Split by default",
        icon: <Pin className="size-4" />,
      };
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
        {splitMethodType
          .sort((a, b) => {
            if (a === SplitMethodType.Default) return -1;
            if (b === SplitMethodType.Default) return 1;
            return a.localeCompare(b);
          })
          .map((t) => {
            const { label, icon } = typeToLabelAndIcon(t);

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
            );
          })}
      </RadioGroup>
    </div>
  );
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
    },
  ),
  paidByMemberId: z.string().min(1, "Required"),
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

type Pool = components["schemas"]["PoolDetails"];

function round(num: number) {
  return Number(num.toFixed(2));
}

export function AddExpenseModal({
  pool,
  isOpen,
  setIsOpen,
}: {
  pool: Pool;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { memberId, createAuthHeader } = useAuth();
  const { mutateAsync: addExpense, isPending } = apiClient.useMutation(
    "post",
    "/api/pools/{pool_id}/expenses",
  );

  const { members, isMembersLoading: isLoading } = usePool({ poolId: pool.id });

  const [splitAmounts, setSplitAmounts] = useState<SplitState>({
    splitMethod: SplitMethodType.Default,
    splitAmounts: members.map((member) => ({
      memberId: member.member.id,
      amount: round(100 / members.length),
    })),
  });

  const resetSplitAmounts = useCallback(() => {
    setSplitAmounts({
      splitMethod: SplitMethodType.Default,
      splitAmounts: members.map((member) => ({
        memberId: member.member.id,
        amount: round(100 / members.length),
      })),
    });
  }, [members]);

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
  });

  if (!members.length || isLoading) {
    return null;
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(value) => {
        setIsOpen(value);
        if (!value) {
          form.reset();
          resetSplitAmounts();
        }
      }}
    >
      <DialogContent className="max-h-10/12 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (data) => {
              const memberLineItemAmounts = splitAmounts.splitAmounts.map(
                (a) => {
                  const member = members.find(
                    (m) => m.member.id === a.memberId,
                  );

                  if (!member) {
                    throw new Error(
                      `Member with id ${a.memberId} not found in pool`,
                    );
                  }

                  const amount =
                    splitAmounts.splitMethod === SplitMethodType.Percentage
                      ? (a.amount / 100) * data.amount
                      : splitAmounts.splitMethod === SplitMethodType.Amount
                        ? a.amount
                        : (member.pool_membership.default_split_percentage /
                            100) *
                          data.amount;

                  return {
                    debtor_member_id: a.memberId,
                    amount,
                  };
                },
              );

              const total = memberLineItemAmounts.reduce(
                (acc, item) => acc + item.amount,
                0,
              );

              const roundingError = Math.abs(total - data.amount);
              const n = memberLineItemAmounts.length;
              const maxRoundingError =
                Math.abs(n * round(data.amount / n) - data.amount) + 0.01;

              if (roundingError < maxRoundingError) {
                memberLineItemAmounts.forEach((item, ix) => {
                  if (ix === 0) {
                    item.amount += roundingError;
                  }
                });
              }

              if (total !== data.amount && roundingError > maxRoundingError) {
                alert(
                  `Total amount (${data.amount}) does not match split amounts (${total})`,
                );
                return;
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
                    setIsOpen(false);
                    await queryClient.invalidateQueries({
                      queryKey: [
                        "get",
                        "/api/pools/{pool_id}/members/{member_id}/expenses",
                      ],
                    });

                    form.reset();
                    resetSplitAmounts();
                  },
                },
              );

              form.reset();
              resetSplitAmounts();
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
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {expenseCategories
                            .sort((a, b) => a.localeCompare(b))
                            .map((c) => (
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
                              if (a.member.id === memberId) return -1;

                              return a.member.first_name.localeCompare(
                                b.member.first_name,
                              );
                            })
                            .map((c) => (
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
                    <div className="flex flex-col gap-y-2">
                      <SplitMethod
                        value={field.value}
                        setValue={(value) => {
                          field.onChange(value);

                          setSplitAmounts(() => {
                            const newAmounts =
                              value === SplitMethodType.Percentage
                                ? members.map((member) => ({
                                    memberId: member.member.id,
                                    amount: round(100 / members.length),
                                  }))
                                : members.map((member) => ({
                                    memberId: member.member.id,
                                    amount: round(
                                      form.getValues("amount") / members.length,
                                    ),
                                  }));

                            return {
                              splitMethod: value,
                              splitAmounts: newAmounts,
                            };
                          });
                        }}
                      />
                      {form.getValues("splitMethod") !==
                        SplitMethodType.Default && (
                        <div className="flex flex-col gap-y-2 border border-[#00000025] p-4 rounded-lg mt-4">
                          {members
                            .sort((a, b) =>
                              a.member.first_name
                                .toLowerCase()
                                .localeCompare(
                                  b.member.first_name.toLowerCase(),
                                ),
                            )
                            .map((m, ix) => (
                              <div
                                className="flex flex-col"
                                key={m.member.email}
                              >
                                <div
                                  key={m.member.id}
                                  className="flex flex-row gap-y-2 justify-between items-center"
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
                                        (a) => a.memberId == m.member.id,
                                      )?.amount
                                    }
                                    onChange={(e) => {
                                      const memberId = m.member.id;

                                      setSplitAmounts((prev) => {
                                        const newAmounts =
                                          prev.splitAmounts.map((a) => {
                                            if (a.memberId === memberId) {
                                              return {
                                                ...a,
                                                amount: round(
                                                  parseFloat(e.target.value),
                                                ),
                                              };
                                            }
                                            return a;
                                          });

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
                      )}
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
  );
}
