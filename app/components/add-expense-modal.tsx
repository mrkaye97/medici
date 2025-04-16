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
  Coffee,
  ShoppingCart,
  ShoppingBag,
  Car,
  Bus,
  Home,
  Lightbulb,
  Plug,
  Stethoscope,
  Heart,
  Tv,
  Film,
  Shirt,
  BookOpen,
  GraduationCap,
  Plane,
  Luggage,
  Scissors,
  Bath,
  Dumbbell,
  Activity,
  CreditCard,
  Calendar,
  Receipt,
  FileText,
  Briefcase,
  TrendingUp,
  BarChart,
  Shield,
  Umbrella,
  Gift,
  HelpingHand,
  Ellipsis,
  MoreHorizontal,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";

enum SplitMethodType {
  Percentage = "percentage",
  Amount = "amount",
}

export type ExpenseCategory =
  | "food_dining"
  | "groceries"
  | "transportation"
  | "housing_rent"
  | "utilities"
  | "healthcare"
  | "entertainment"
  | "shopping"
  | "education"
  | "travel"
  | "personal_care"
  | "fitness"
  | "subscriptions"
  | "bills_payments"
  | "business_expenses"
  | "investments"
  | "insurance"
  | "gifts"
  | "charity"
  | "miscellaneous";

export const expenseCategories: ExpenseCategory[] = [
  "food_dining",
  "groceries",
  "transportation",
  "housing_rent",
  "utilities",
  "healthcare",
  "entertainment",
  "shopping",
  "education",
  "travel",
  "personal_care",
  "fitness",
  "subscriptions",
  "bills_payments",
  "business_expenses",
  "investments",
  "insurance",
  "gifts",
  "charity",
  "miscellaneous",
];

export const categoryToIcon = ({
  category,
  size = 4,
}: {
  category: ExpenseCategory;
  size?: number;
}) => {
  switch (category) {
    case "food_dining":
      return <Utensils className={`size-${size}`} />;
    case "groceries":
      return <ShoppingCart className={`size-${size}`} />;
    case "transportation":
      return <Car className={`size-${size}`} />;
    case "housing_rent":
      return <Home className={`size-${size}`} />;
    case "utilities":
      return <Plug className={`size-${size}`} />;
    case "healthcare":
      return <Stethoscope className={`size-${size}`} />;
    case "entertainment":
      return <Tv className={`size-${size}`} />;
    case "shopping":
      return <ShoppingBag className={`size-${size}`} />;
    case "education":
      return <GraduationCap className={`size-${size}`} />;
    case "travel":
      return <Plane className={`size-${size}`} />;
    case "personal_care":
      return <Bath className={`size-${size}`} />;
    case "fitness":
      return <Dumbbell className={`size-${size}`} />;
    case "subscriptions":
      return <CreditCard className={`size-${size}`} />;
    case "bills_payments":
      return <Receipt className={`size-${size}`} />;
    case "business_expenses":
      return <Briefcase className={`size-${size}`} />;
    case "investments":
      return <TrendingUp className={`size-${size}`} />;
    case "insurance":
      return <Shield className={`size-${size}`} />;
    case "gifts":
      return <Gift className={`size-${size}`} />;
    case "charity":
      return <HelpingHand className={`size-${size}`} />;
    case "miscellaneous":
      return <Ellipsis className={`size-${size}`} />;
    case "bills_payments":
      return <FileText className={`size-${size}`} />;
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
    case "food_dining":
      return "Food & Dining";
    case "groceries":
      return "Groceries";
    case "transportation":
      return "Transportation";
    case "housing_rent":
      return "Housing & Rent";
    case "utilities":
      return "Utilities";
    case "healthcare":
      return "Healthcare";
    case "entertainment":
      return "Entertainment";
    case "shopping":
      return "Shopping";
    case "education":
      return "Education";
    case "travel":
      return "Travel";
    case "personal_care":
      return "Personal Care";
    case "fitness":
      return "Fitness";
    case "subscriptions":
      return "Subscriptions";
    case "bills_payments":
      return "Bills & Payments";
    case "business_expenses":
      return "Business Expenses";
    case "investments":
      return "Investments";
    case "insurance":
      return "Insurance";
    case "gifts":
      return "Gifts";
    case "charity":
      return "Charity";
    case "miscellaneous":
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
  category: z.string(),
  description: z.string().optional(),
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
  const { data, isLoading } = useQuery(
    trpc.listMembersOfPool.queryOptions(
      {
        poolId: pool.id,
        memberId: id || "",
      },
      {
        enabled: !!id,
      }
    )
  );
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
      category: "miscellaneous",
      description: undefined,
      splitMethod: SplitMethodType.Percentage,
    },
  });

  if (!data || isLoading) {
    return null;
  }

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
      <DialogContent className="ml-32 max-h-10/12 overflow-y-auto">
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
                  description: data.description,
                  category: data.category,
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Our hotel room in Yosemite" />
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
