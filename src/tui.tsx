import type { TuiPluginModule } from "@kilocode/plugin/tui"
import { createSignal, Show, type JSX } from "solid-js"
import { registerSpinner } from "opentui-spinner/solid"

const PLUGIN_ID = "kilo-openrouter-vision"
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const COMMAND_PREFIX = "kilo.openrouter-vision:"

// Register the native <spinner> intrinsic (from opentui-spinner) so OPenTUI's
// animation engine drives the frames — a plain signal/timer does not repaint.
registerSpinner()

function Spinner(props: { label: string }): JSX.Element {
  return (
    <box flexDirection="row" gap={1}>
      <spinner frames={SPINNER_FRAMES} interval={80} />
      <text>{props.label}</text>
    </box>
  )
}

const plugin: TuiPluginModule = {
  id: PLUGIN_ID,
  async tui(api) {
    const [busy, setBusy] = createSignal<string | null>(null)

    api.event.on(
      "tui.command.execute" as never,
      (event: { type: string; properties: { command: string } }) => {
        const command = event.properties.command
        if (!command.startsWith(COMMAND_PREFIX)) return
        const payload = command.slice(COMMAND_PREFIX.length)
        if (payload === "end") setBusy(null)
        else setBusy(decodeURIComponent(payload))
      },
    )

    api.slots.register({
      order: 0,
      slots: {
        session_prompt_right: (_ctx) => (
          <Show when={busy()} fallback={null}>
            {(label) => <Spinner label={label()} />}
          </Show>
        ),
      },
    })
  },
}

export default plugin
