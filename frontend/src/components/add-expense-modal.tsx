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
import { useState } from "react";
import { Separator } from "./ui/separator";
import { useAuth } from "@/hooks/auth";
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

enum SplitMethodType {
  Percentage = "percentage",
  Amount = "amount",
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
  const { id } = useAuth();
  const { mutate: addExpense } = apiClient.useMutation(
    "post",
    "/api/pools/{pool_id}/expenses"
  );

  const { data, isLoading } = apiClient.useQuery(
    "get",
    "/api/members/{member_id}/pools/{pool_id}/members",
    {
      params: {
        path: {
          pool_id: pool.id,
          member_id: id || "",
        },
      },
    },
    {
      enabled: !!id,
    }
  );

  const members = data ?? [];
  const [splitAmounts, setSplitAmounts] = useState<SplitState>({
    splitMethod: SplitMethodType.Percentage,
    splitAmounts: members.map((member) => ({
      memberId: member.member.id,
      amount: 100 / members.length,
    })),
  });

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      expenseName: "",
      amount: 0,
      category: "Miscellaneous",
      description: undefined,
      splitMethod: SplitMethodType.Percentage,
      paidByMemberId: id || "",
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
              console.log(data);
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
                  body: {
                    paid_by_member_id: data.paidByMemberId,
                    pool_id: pool.id,
                    name: data.expenseName,
                    amount: data.amount,
                    line_items: memberLineItemAmounts,
                    description: data.description,
                    category: data.category,
                  },
                  params: {
                    path: {
                      pool_id: pool.id,
                    },
                  },
                },
                {
                  onSuccess: async () => {
                    setIsOpen(false);
                    await queryClient.invalidateQueries({
                      queryKey: [
                        "get",
                        "/api/members/{member_id}/pools/{pool_id}/members",
                      ],
                    });

                    form.reset();
                  },
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
                              if (a.member.id === id) return -1;

                              return a.member.first_name.localeCompare(
                                b.member.first_name
                              );
                            })
                            .map((c) => (
                              <SelectItem
                                key={c.member.id}
                                value={c.member.id}
                                className="flex items-center gap-x-2"
                              >
                                <p>{`${c.member.first_name} ${c.member.last_name} ${c.member.id === id ? "(Me)" : ""}`}</p>
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
                                    amount: 100 / members.length,
                                  }))
                                : members.map((member) => ({
                                    memberId: member.member.id,
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
                          <div className="flex flex-col" key={m.member.email}>
                            <div
                              key={m.member.id}
                              className="flex flex-row gap-y-2 justify-between items-center"
                            >
                              <Label
                                htmlFor={m.member.id}
                                className="flex flex-row items-center gap-x-2"
                              >
                                {m.member.first_name}
                              </Label>
                              <Input
                                type="number"
                                value={
                                  splitAmounts.splitAmounts.find(
                                    (a) => a.memberId == m.member.id
                                  )?.amount
                                }
                                onChange={(e) => {
                                  const memberId = m.member.id;

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
