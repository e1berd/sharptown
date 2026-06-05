defmodule CaptureTransport do
  @moduledoc false
  @behaviour Sharptown.Transport

  @impl true
  def transform(request, _opts) do
    {:ok,
     %Sharptown.Response{
       status: 200,
       headers: %{
         "content-type" => "image/webp",
         "x-query" => Sharptown.Operations.to_query(request.operations)
       },
       body: "BYTES"
     }}
  end
end

defmodule SharptownTest do
  use ExUnit.Case, async: true

  alias Sharptown.Input

  defp client, do: Sharptown.client("http://localhost:3001/", transport: {CaptureTransport, []})

  test "chain serializes operations in canonical order" do
    {:ok, response} =
      client()
      |> Sharptown.transform({:bytes, "raw", "in.png"})
      |> Sharptown.resize(800, 600)
      |> Sharptown.blur(3)
      |> Sharptown.grayscale()
      |> Sharptown.sharpen()
      |> Sharptown.saturation(1.2)
      |> Sharptown.aspect_ratio(1.5)
      |> Sharptown.convert(:webp)
      |> Sharptown.quality(80)
      |> Sharptown.run()

    assert response.body == "BYTES"

    assert response.headers["x-query"] ==
             "width=800&height=600&aspectRatio=1.5&blur=3&sharpen=true&saturation=1.2&grayscale=true&convertTo=webp&quality=80"
  end

  test "base url trailing slash is stripped" do
    assert client().base_url == "http://localhost:3001"
  end

  test "unsupported format is rejected before the request" do
    assert_raise Sharptown.Error, fn ->
      client() |> Sharptown.transform({:bytes, "x"}) |> Sharptown.convert(:tiff)
    end
  end

  test "out-of-range value is rejected" do
    assert_raise Sharptown.Error, fn ->
      client() |> Sharptown.transform({:bytes, "x"}) |> Sharptown.saturation(9)
    end
  end

  test "a bare non-file string is rejected" do
    assert_raise Sharptown.Error, fn ->
      Input.from("definitely-not-a-real-file.zzz")
    end
  end

  test "from_bytes resolves bytes, filename and content type" do
    assert {:ok, {"abc", "pic.jpg", "image/jpeg"}} =
             Input.resolve(Input.from_bytes("abc", "pic.jpg"))
  end

  test "tint sets only the given channels" do
    {:ok, response} =
      client()
      |> Sharptown.transform({:bytes, "x"})
      |> Sharptown.tint(10, nil, 20)
      |> Sharptown.run()

    assert response.headers["x-query"] == "r=10&b=20"
  end
end
