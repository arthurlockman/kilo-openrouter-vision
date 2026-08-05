import type { TuiPluginModule } from "@kilocode/plugin/tui"
import { createSignal, onCleanup, Show, type JSX } from "solid-js"

const PLUGIN_ID = "kilo-openrouter-vision"
const MARKER = "kilo-openrouter-vision"
const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

function Spinner(props: { label: string }): JSX.Element {
  const [frame, setFrame] = createSignal(0)
  const timer = setInterval(() => setFrame((value) => (value + 1) % FRAMES.length), 80)
  onCleanup(() => clearInterval(timer))
  return <text>{FRAMES[frame()]} {props.label}</text>
}

const plugin: TuiPluginModule = {
  id: PLUGIN_ID,
  async tui(api) {
    const [busy, setBusy] = createSignal<string | null>(null)

    api.event.on("tui.toast.show", ({ properties }) => {
      if (properties.title !== MARKER) return
      setBusy(properties.message.startsWith("Describing") ? properties.message : null)
    })

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
