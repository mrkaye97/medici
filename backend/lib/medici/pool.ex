defmodule Medici.Pool do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @derive {Jason.Encoder, only: [:id, :name, :description, :inserted_at, :updated_at]}
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
