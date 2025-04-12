defmodule Medici.Queries do
  alias Medici.Repo

  def get_members do
    sql = "SELECT * FROM member"
    {:ok, result} = Ecto.Adapters.SQL.query(Repo, sql, [])
    result.rows
  end

  def get_member_by_email(email) do
    sql = "SELECT * FROM member WHERE email = $1"
    {:ok, result} = Ecto.Adapters.SQL.query(Repo, sql, [email])
    result.rows
  end
end
