defmodule Medici.Repo do
  use Ecto.Repo,
    otp_app: :medici,
    adapter: Ecto.Adapters.Postgres
end
