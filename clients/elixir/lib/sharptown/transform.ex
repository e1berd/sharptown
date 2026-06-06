defmodule Sharptown.Transform do
  @moduledoc """
  The accumulated state of a transform chain: the client, the image input, an optional
  filename and the canonical operation map. Built and run through the `Sharptown` module.
  """

  @enforce_keys [:client, :input]
  defstruct [:client, :input, :filename, ops: %{}, marks: []]

  @type t :: %__MODULE__{
          client: Sharptown.Client.t(),
          input: Sharptown.Input.t(),
          filename: String.t() | nil,
          ops: %{String.t() => term()},
          marks: list()
        }
end
