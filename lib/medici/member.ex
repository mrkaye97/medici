defmodule Medici.Member do
  use Ecto.Schema
  import Ecto.Changeset

  schema "member" do
    field(:first_name, :string)
    field(:last_name, :string)
    field(:email, :string)

    has_many(:pool_membership, Medici.PoolMembership)

    timestamps()
  end

  def changeset(member, attrs) do
    member
    |> cast(attrs, [:first_name, :last_name, :email])
    |> validate_required([:first_name, :last_name, :email])
    |> unique_constraint(:email)
  end
end
