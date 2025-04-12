defmodule Medici.Expense do
  use Ecto.Schema
  import Ecto.Changeset

  schema "expense" do
    field(:name, :string)
    field(:amount, :decimal)
    field(:is_settled, :boolean, default: false)

    has_many(:line_items, Medici.LineItem)

    timestamps()
  end

  def changeset(expense, attrs) do
    expense
    |> cast(attrs, [:name, :amount, :is_settled])
    |> validate_required([:name, :amount])
  end
end
