defmodule Sharptown.E2ETest do
  @moduledoc """
  End-to-end tests against running Sharptown servers. Excluded by default; run with:

      mix test --include e2e

  Start the servers first (from the repo root): `pnpm rest` and `pnpm jsonrpc`.
  """

  use ExUnit.Case, async: false

  @moduletag :e2e

  @png Base.decode64!(
         "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAFElEQVQImWOUm/CfARtgwio6aCUAUgQBvQtLKDIAAAAASUVORK5CYII="
       )

  defp webp?(<<"RIFF", _size::binary-size(4), "WEBP", _rest::binary>>), do: true
  defp webp?(_), do: false

  describe "REST transport" do
    setup do
      {:ok, client: Sharptown.client("http://localhost:3001")}
    end

    test "transforms to webp", %{client: client} do
      assert {:ok, response} =
               client
               |> Sharptown.transform({:bytes, @png, "in.png"})
               |> Sharptown.resize(64, 48)
               |> Sharptown.grayscale()
               |> Sharptown.convert(:webp)
               |> Sharptown.quality(80)
               |> Sharptown.run()

      assert response.status == 200
      assert Sharptown.Response.content_type(response) == "image/webp"
      assert webp?(response.body)
    end

    test "rejects a corrupt image", %{client: client} do
      assert {:error, %Sharptown.Error{status: 415}} =
               client
               |> Sharptown.transform({:bytes, "not-an-image", "broken.png"})
               |> Sharptown.convert(:webp)
               |> Sharptown.run()
    end
  end

  describe "JSON-RPC transport" do
    setup do
      {:ok, client: Sharptown.client("ws://localhost:3002", transport: Sharptown.jsonrpc())}
    end

    test "transforms to webp", %{client: client} do
      assert {:ok, response} =
               client
               |> Sharptown.transform({:bytes, @png, "in.png"})
               |> Sharptown.resize(50)
               |> Sharptown.blur(2)
               |> Sharptown.convert(:webp)
               |> Sharptown.run()

      assert Sharptown.Response.content_type(response) == "image/webp"
      assert webp?(response.body)
    end

    test "rejects a corrupt image", %{client: client} do
      assert {:error, %Sharptown.Error{}} =
               client
               |> Sharptown.transform({:bytes, "not-an-image"})
               |> Sharptown.convert(:webp)
               |> Sharptown.run()
    end
  end
end
