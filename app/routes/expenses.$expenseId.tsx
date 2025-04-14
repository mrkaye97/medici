import { formatDate } from "@/components/expense";
import { Spinner } from "@/components/ui/spinner";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { GetExpenseRow } from "backend/src/db/query_sql";
import { useState } from "react";
import { useTRPC } from "trpc/react";

export const Route = createFileRoute("/expenses/$expenseId")({
  component: ExpenseDetailView,
});

function ExpenseDetailView() {
  const [isEditing, setIsEditing] = useState(false);
  const trpc = useTRPC();
  const { expenseId } = Route.useParams();
  const { data, isLoading } = useQuery(trpc.getExpense.queryOptions(expenseId));

  if (isLoading || !data) {
    return (
      <div className="flex flex-col items-center">
        <Spinner className="mt-8" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Expense Details</h1>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {isEditing ? "Cancel" : "Edit"}
          </button>
        </div>

        {isEditing ? (
          <EditForm expense={mockExpense} />
        ) : (
          <ViewDetails expense={mockExpense} />
        )}
      </div>
    </div>
  );
}

function ViewDetails({ expense }: { expense: GetExpenseRow }) {
  return (
    <div className="space-y-4">
      <DetailRow label="Date" value={formatDate(expense.insertedAt)} />
      <DetailRow label="Amount" value={`$${expense.amount.toFixed(2)}`} />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex border-b border-gray-200 py-3">
      <span className="w-1/3 text-gray-600 font-medium">{label}</span>
      <span className="w-2/3 text-gray-900">{value}</span>
    </div>
  );
}

function InputField({
  label,
  type,
  defaultValue,
  name,
  step,
}: {
  label: string;
  type: string;
  defaultValue: string | number;
  name: string;
  step?: string;
}) {
  return (
    <div>
      <label className="block text-gray-700 mb-2">{label}</label>
      <input
        type={type}
        defaultValue={defaultValue}
        name={name}
        step={step}
        className="w-full p-2 border rounded-md"
      />
    </div>
  );
}
