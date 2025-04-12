defmodule Medici.LineItem do
  use Ecto.Schema
  import Ecto.Changeset

  schema "line_items" do
    field(:amount, :decimal)

    belongs_to(:expense, Medici.Expense)

    timestamps()
  end

  def changeset(line_item, attrs) do
    line_item
    |> cast(attrs, [:amount, :expense_id])
    |> validate_required([:amount, :expense_id])
  end
end
