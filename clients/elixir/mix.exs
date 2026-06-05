defmodule Sharptown.MixProject do
  use Mix.Project

  @version "1.0.0"
  @source_url "https://github.com/sharptown/sharptown"

  def project do
    [
      app: :sharptown,
      version: @version,
      elixir: "~> 1.15",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      description: description(),
      package: package(),
      name: "Sharptown",
      source_url: @source_url,
      docs: docs()
    ]
  end

  def application do
    [
      extra_applications: [:inets, :ssl, :crypto, :public_key]
    ]
  end

  defp deps do
    []
  end

  defp description do
    "Expressive, dependency-free Elixir client for the Sharptown image transformation API " <>
      "(REST, JSON-RPC and gRPC transports). Requires OTP 27+ for the built-in JSON support."
  end

  defp package do
    [
      licenses: ["MIT"],
      links: %{"GitHub" => @source_url},
      files: ~w(lib mix.exs README.md LICENSE .formatter.exs)
    ]
  end

  defp docs do
    [
      main: "Sharptown",
      extras: ["README.md"]
    ]
  end
end
