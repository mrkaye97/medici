defmodule Medici.PoolMembership do
  use Ecto.Schema
  import Ecto.Changeset

  @roles ~w(participant admin)a
  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @derive {Jason.Encoder, only: [:id, :role, :member_id, :pool_id, :inserted_at, :updated_at]}
  schema "pool_membership" do
    field(:role, Ecto.Enum, values: @roles)

    belongs_to(:member, Medici.Member)
    belongs_to(:pool, Medici.Pool)

    timestamps()
  end

  def changeset(pool_membership, attrs) do
    pool_membership
    |> cast(attrs, [:member_id, :pool_id, :role])
    |> validate_required([:member_id, :pool_id])
    |> unique_constraint([:pool_id, :member_id])
  end
end
