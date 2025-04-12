defmodule Medici.Router do
  use Plug.Router
  plug(Plug.Logger)

  plug(Plug.Parsers,
    parsers: [:urlencoded, :json],
    pass: ["*/*"],
    json_decoder: Jason
  )

  plug(:match)
  plug(:dispatch)

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

  get "/users" do
    users = Medici.Repo.all(Medici.User)

    json(conn, %{users: users})
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
