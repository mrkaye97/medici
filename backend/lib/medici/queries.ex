defmodule Medici.Queries do
  alias Medici.Repo

  def query_with_format(sql, params \\ []) do
    result = Ecto.Adapters.SQL.query!(Medici.Repo, sql, params)

    columns = Enum.map(result.columns, &String.to_atom/1)

    Enum.map(result.rows, fn row ->
      row
      |> Enum.zip(columns)
      |> Enum.map(fn {value, column} -> {column, format_value(value)} end)
      |> Enum.into(%{})
    end)
  end

  def format_value(value) when is_binary(value) and byte_size(value) == 16 do
    case Ecto.UUID.cast(value) do
      {:ok, uuid} -> uuid
      :error -> value
    end
  end

  def format_value(%NaiveDateTime{} = dt), do: NaiveDateTime.to_string(dt)
  def format_value(%DateTime{} = dt), do: DateTime.to_string(dt)
  def format_value(%Date{} = d), do: Date.to_string(d)
  def format_value(%Time{} = t), do: Time.to_string(t)
  def format_value(value), do: value

  def get_members do
    "SELECT * FROM member" |> query_with_format()
  end

  def get_member_by_email(email) do
    "SELECT * FROM member WHERE email = $1" |> query_with_format([email])
  end
end
