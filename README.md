# Kilo OpenRouter Vision

A Kilo CLI plugin that lets text-only models understand pasted images by replacing each image with a task-aware description from an OpenRouter vision model.

The plugin checks Kilo's resolved model capabilities before doing anything:

- If the selected model supports image input, the original image passes through unchanged and OpenRouter is not called.
- If the selected model does not support image input, the plugin sends the image to OpenRouter and replaces it with a synthetic text description.
- If the selected model's capabilities cannot be resolved, the plugin fails closed and does not send the image remotely.

## Requirements

- Kilo CLI 7.3.1 or newer
- Node.js 20 or newer
- An [OpenRouter API key](https://openrouter.ai/keys)

## Installation

Set the API key in the environment that launches Kilo:

```sh
export OPENROUTER_API_KEY="sk-or-v1-..."
```

After the package is published to npm, add it to `kilo.json` or `kilo.jsonc`:

```json
{
  "plugin": [
    [
      "kilo-openrouter-vision",
      {
        "model": "qwen/qwen3.7-flash"
      }
    ]
  ]
}
```

For a local checkout, build the package and reference its server entrypoint with an absolute file URL:

```sh
npm install
npm run build
```

```json
{
  "plugin": [
    [
      "file:///absolute/path/to/kilo-openrouter-vision/dist/index.js",
      {
        "model": "qwen/qwen3.7-flash"
      }
    ]
  ]
}
```

Restart Kilo after changing plugin configuration.

## Configuration

| Option | Default | Description |
| --- | --- | --- |
| `model` | `qwen/qwen3.7-flash` | OpenRouter vision model used for descriptions. |
| `apiKeyEnv` | `OPENROUTER_API_KEY` | Environment variable containing the OpenRouter API key. |
| `timeoutMs` | `30000` | OpenRouter request timeout in milliseconds. |
| `maxTokens` | `1200` | Maximum description output tokens per image. |
| `maxImageBytes` | `5242880` | Maximum decoded size for pasted base64 images. |
| `zeroDataRetention` | `true` | Restrict routing to OpenRouter endpoints with a zero-data-retention policy. |

Example with all options:

```json
{
  "plugin": [
    [
      "kilo-openrouter-vision",
      {
        "model": "google/gemini-2.5-flash-lite",
        "apiKeyEnv": "OPENROUTER_API_KEY",
        "timeoutMs": 30000,
        "maxTokens": 1200,
        "maxImageBytes": 5242880,
        "zeroDataRetention": true
      }
    ]
  ]
}
```

OpenRouter's ZDR restriction can reduce model or provider availability. Set `zeroDataRetention` to `false` only after reviewing the relevant provider privacy policies.

## Supported Images

- PNG
- JPEG
- WebP
- GIF

Pasted images are normally represented by Kilo as base64 data URLs. HTTP and HTTPS image URLs are also accepted. Other URL schemes and image formats fail before an OpenRouter request is made.

## Privacy And Security

- Images are sent to OpenRouter only when Kilo reports that the selected model lacks image input support.
- The API key is read from an environment variable and is never stored in plugin configuration.
- Zero-data-retention routing is enabled by default.
- Base64 image content is not logged by the plugin.
- Text extracted from images is explicitly marked as untrusted content to reduce prompt-injection risk.
- Multiple images are transformed atomically: if any description fails, the original message parts remain unchanged.

## Development

```sh
npm install
npm run check
npm pack --dry-run
```

The test suite covers capability routing, API-key behavior, image validation, request construction, model resolution, and atomic multi-image failure handling.

## Releasing

Future releases publish from GitHub Actions through npm trusted publishing:

1. Update the version in `package.json` and `package-lock.json` with `npm version`.
2. Push the commit and generated `vX.Y.Z` tag.
3. The `publish.yml` workflow verifies the tag, runs all checks, and publishes to npm with provenance.

Configure the package's trusted publisher on npm with:

- Provider: GitHub Actions
- Organization or user: `arthurlockman`
- Repository: `kilo-openrouter-vision`
- Workflow filename: `publish.yml`
- Allowed action: `npm publish`

## License

MIT
