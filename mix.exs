defmodule Medici.MixProject do
  use Mix.Project

  def project do
    [
      app: :medici,
      version: "0.1.0",
      elixir: "~> 1.18",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  def application do
    [
      extra_applications: extra_applications(Mix.env(), [:logger]),
      mod: {Medici.Application, []}
    ]
  end

  defp extra_applications(:dev, default), do: default ++ [:lettuce]
  defp extra_applications(_, default), do: default

  defp deps do
    [
      {:plug_cowboy, "~> 2.5"},
      {:jason, "~> 1.4"},
      {:ecto_sql, "~> 3.10"},
      {:postgrex, ">= 0.0.0"},
      {:lettuce, ">= 0.2.0", only: :dev}
    ]
  end
end
