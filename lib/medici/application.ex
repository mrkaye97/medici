defmodule Medici.Application do
  use Application

  @spec start(any(), any()) :: {:error, any()} | {:ok, pid()}
  def start(_type, _args) do
    children = [
      {Plug.Cowboy, scheme: :http, plug: Medici.Router, options: [port: 4000]}
    ]

    opts = [strategy: :one_for_one, name: Medici.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
