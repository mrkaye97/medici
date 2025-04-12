defmodule Medici.Pool do
  use Ecto.Schema
  import Ecto.Changeset

  schema "pool" do
    field(:name, :string)
    field(:description, :string)

    has_many(:pool_membership, Medici.PoolMembership)

    timestamps()
  end

  def changeset(pool, attrs) do
    pool
    |> cast(attrs, [:name, :description])
    |> validate_required([:name])
  end
end
