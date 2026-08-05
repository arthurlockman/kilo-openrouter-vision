import type { PluginInput } from "@kilocode/plugin"
import type { Model, Part, Provider, UserMessage } from "@kilocode/sdk"
import { describe, expect, it, vi } from "vitest"

import {
  createOpenRouterVisionPlugin,
  findSelectedModel,
  normalizeImageUrl,
  resolveOptions,
} from "./index.js"

const selected = { providerID: "test", modelID: "model" }

function model(image: boolean): Model {
  return {
    id: "model",
    providerID: "test",
    api: { id: "test", url: "https://example.com", npm: "test" },
    name: "Test model",
    capabilities: {
      temperature: true,
      reasoning: false,
      attachment: image,
      toolcall: true,
      input: { text: true, audio: false, image, video: false, pdf: false },
      output: { text: true, audio: false, image: false, video: false, pdf: false },
    },
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    limit: { context: 32_000, output: 4_000 },
    status: "active",
    options: {},
    headers: {},
  }
}

function provider(image: boolean): Provider {
  return {
    id: "test",
    name: "Test",
    source: "config",
    env: [],
    options: {},
    models: { model: model(image) },
  }
}

function message(): UserMessage {
  return {
    id: "message",
    sessionID: "session",
    role: "user",
    time: { created: Date.now() },
    agent: "code",
    model: selected,
  }
}

function imagePart(id = "image"): Extract<Part, { type: "file" }> {
  return {
    id,
    sessionID: "session",
    messageID: "message",
    type: "file",
    mime: "image/png",
    filename: `${id}.png`,
    url: "data:image/png;base64,aGVsbG8=",
  }
}

function textPart(): Extract<Part, { type: "text" }> {
  return {
    id: "text",
    sessionID: "session",
    messageID: "message",
    type: "text",
    text: "Explain this error screenshot.",
  }
}

function pluginInput(providers: Provider[]): PluginInput {
  return {
    client: {
      config: {
        providers: vi.fn().mockResolvedValue({
          data: { providers, default: {} },
        }),
      },
    } as unknown as PluginInput["client"],
    project: {} as PluginInput["project"],
    directory: "/tmp",
    worktree: "/tmp",
    experimental_workspace: { register: vi.fn() },
    serverUrl: new URL("http://localhost"),
    $: {} as PluginInput["$"],
  }
}

async function runHook(
  providers: Provider[],
  parts: Part[],
  fetchImpl: typeof fetch,
  env: NodeJS.ProcessEnv = { OPENROUTER_API_KEY: "secret" },
): Promise<void> {
  const plugin = createOpenRouterVisionPlugin({ fetchImpl, env })
  const hooks = await plugin(pluginInput(providers))
  await hooks["chat.message"]?.(
    { sessionID: "session", model: selected },
    { message: message(), parts },
  )
}

describe("capability routing", () => {
  it("does nothing when the selected model supports image input", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const parts: Part[] = [textPart(), imagePart()]
    const before = structuredClone(parts)

    await runHook([provider(true)], parts, fetchImpl)

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(parts).toEqual(before)
  })

  it("replaces images for a text-only model", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "A compiler error." } }] }),
        { status: 200 },
      ),
    )
    const parts: Part[] = [textPart(), imagePart()]

    await runHook([provider(false)], parts, fetchImpl)

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(parts[0]).toEqual(textPart())
    expect(parts[1]).toMatchObject({
      id: "image",
      type: "text",
      synthetic: true,
      text: expect.stringContaining("A compiler error."),
    })

    const request = fetchImpl.mock.calls[0]?.[1]
    const body = JSON.parse(String(request?.body)) as {
      messages: Array<{ content: Array<{ type: string; text?: string }> }>
      provider?: { zdr?: boolean }
    }
    expect(body.messages[0]?.content[0]?.text).toContain(
      "Explain this error screenshot.",
    )
    expect(body.provider).toEqual({ zdr: true })
  })

  it("does not partially mutate when one image request fails", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: "First image" } }] }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "failed" } }), {
          status: 500,
        }),
      )
    const parts: Part[] = [imagePart("first"), imagePart("second")]
    const before = structuredClone(parts)

    await expect(runHook([provider(false)], parts, fetchImpl)).rejects.toThrow("failed")
    expect(parts).toEqual(before)
  })

  it("does not require an API key when there is no image", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const parts: Part[] = [textPart()]

    await runHook([provider(false)], parts, fetchImpl, {})

    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("ignores non-image file attachments", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const file: Extract<Part, { type: "file" }> = {
      ...imagePart(),
      mime: "text/plain",
      filename: "notes.txt",
      url: "data:text/plain;base64,aGVsbG8=",
    }
    const parts: Part[] = [file]

    await runHook([provider(false)], parts, fetchImpl, {})

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(parts).toEqual([file])
  })

  it("requires an API key for text-only models", async () => {
    await expect(
      runHook([provider(false)], [imagePart()], vi.fn<typeof fetch>(), {}),
    ).rejects.toThrow("OPENROUTER_API_KEY is required")
  })
})

describe("helpers", () => {
  it("resolves models by their model id when the record key differs", () => {
    const testProvider = provider(false)
    testProvider.models = { alias: model(false) }
    expect(findSelectedModel([testProvider], selected).id).toBe("model")
  })

  it("fails closed when model metadata cannot be resolved", () => {
    expect(() => findSelectedModel([], selected)).toThrow("refusing to send")
  })

  it("normalizes image/jpg data URLs", () => {
    const part = imagePart()
    part.mime = "image/jpg"
    part.url = "data:image/jpg;base64,aGVsbG8="
    expect(normalizeImageUrl(part, 100)).toBe(
      "data:image/jpeg;base64,aGVsbG8=",
    )
  })

  it("rejects oversized image data", () => {
    expect(() => normalizeImageUrl(imagePart(), 2)).toThrow("exceeding")
  })

  it("rejects local file URLs", () => {
    const part = imagePart()
    part.url = "file:///tmp/image.png"
    expect(() => normalizeImageUrl(part, 100)).toThrow(
      "Unsupported image URL protocol",
    )
  })

  it("validates numeric options", () => {
    expect(() => resolveOptions({ timeoutMs: 0 })).toThrow(
      "timeoutMs must be a positive number",
    )
  })
})
