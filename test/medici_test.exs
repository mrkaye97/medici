defmodule MediciTest do
  use ExUnit.Case
  doctest Medici

  test "greets the world" do
    assert Medici.hello() == :world
  end
end
