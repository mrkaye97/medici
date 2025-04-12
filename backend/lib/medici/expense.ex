defmodule Medici.Expense do
  use Ecto.Schema
  import Ecto.Changeset
  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @derive {Jason.Encoder, only: [:id, :name, :amount, :is_settled, :inserted_at, :updated_at]}
  schema "expense" do
    field(:name, :string)
    field(:amount, :decimal)
    field(:is_settled, :boolean, default: false)

    has_many(:line_item, Medici.LineItem)

    timestamps()
  end

  def changeset(expense, attrs) do
    expense
    |> cast(attrs, [:name, :amount, :is_settled])
    |> validate_required([:name, :amount])
  end
end
