import Config

config :medici, Medici.Repo,
  database: "medici",
  username: "postgres",
  password: "postgres",
  hostname: "localhost",
  port: 5442,
  show_sensitive_data_on_connection_error: true,
  pool_size: 10

config :medici, ecto_repos: [Medici.Repo]
config :lettuce, folders_to_watch: ["lib", "priv", "config"]
