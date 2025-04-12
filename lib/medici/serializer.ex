defmodule Medici.Serializer do
  # Serialize UUIDs correctly, handle both UUID binaries directly.
  def serialize_uuid(uuid) when is_binary(uuid) do
    # Binary UUIDs can be directly dumped.
    Ecto.UUID.dump!(uuid)
  end

  def serialize_uuid(uuid) do
    # Return UUID as-is if not binary.
    uuid
  end

  # General recursive serialization for maps and lists
  def serialize(value) when is_map(value) do
    Enum.reduce(value, %{}, fn {key, val}, acc ->
      Map.put(acc, key, serialize(val))
    end)
  end

  def serialize(value) when is_list(value) do
    Enum.map(value, &serialize(&1))
  end

  def serialize(value), do: value
end
