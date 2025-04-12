defmodule Medici.LineItem do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @derive {Jason.Encoder, only: [:id, :amount, :expense_id, :inserted_at, :updated_at]}
  schema "line_item" do
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
