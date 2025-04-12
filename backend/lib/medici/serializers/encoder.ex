defimpl Jason.Encoder, for: Medici.Member do
  def encode(
        %Medici.Member{
          id: id,
          first_name: first_name,
          last_name: last_name,
          email: email,
          inserted_at: inserted_at,
          updated_at: updated_at
        },
        opts
      ) do
    %{
      id: Ecto.UUID.dump!(id),
      first_name: first_name,
      last_name: last_name,
      email: email,
      inserted_at: DateTime.to_iso8601(inserted_at),
      updated_at: DateTime.to_iso8601(updated_at)
    }
    |> Jason.Encode.map(opts)
  end
end
