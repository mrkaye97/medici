defmodule Medici.Router do
  use Plug.Router

  plug(:match)
  plug(:dispatch)

  get "/hello" do
    send_resp(conn, 200, "Hello, world!")
  end

  get "/hello/:id" do
    id = conn.params["id"]
    send_resp(conn, 200, "Hello, #{id}!")
  end

  match _ do
    send_resp(conn, 404, "Not Found")
  end
end
