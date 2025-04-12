defmodule Medici.Router do
  alias Medici.Serializer
  alias Medici.Queries
  use Plug.Router
  plug(Plug.Logger)

  plug(Plug.Parsers,
    parsers: [:urlencoded, :json],
    pass: ["*/*"],
    json_decoder: Jason
  )

  plug(:match)
  plug(:dispatch)

  get "/pools" do
    pools = Medici.Repo.all(Medici.Pool)

    json(conn, %{pools: pools})
  end

  get "/members" do
    members = Queries.get_members()

    IO.inspect(members, label: "Members from DB")

    json(conn, %{members: Serializer.serialize(members)})
  end

  get "/expenses" do
    json(conn, ["these", "are", "your", "expenses"])
  end

  get "/expenses/:id" do
    id = conn.params["id"]
    send_resp(conn, 200, "Expense: #{id}")
  end

  post "/expenses" do
    json(conn, %{you_sent: conn.body_params})
  end

  match _ do
    send_resp(conn, 404, "Not Found")
  end

  defp json(conn, data) do
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(200, Jason.encode!(data))
  end
end
