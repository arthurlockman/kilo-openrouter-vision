import type { TuiPluginModule } from "@kilocode/plugin/tui"
import { createSignal, Show, type JSX } from "solid-js"

const PLUGIN_ID = "kilo-openrouter-vision"
const MARKER = "kilo-openrouter-vision"
const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

// Module-scope frame clock. Kept outside the component tree so its owner is
// never disposed by the slot reconciler (which would clear a component-scoped
// timer and freeze the spinner).
const [frame, setFrame] = createSignal(0)
setInterval(() => setFrame((value) => (value + 1) % FRAMES.length), 80)

function Spinner(props: { label: string }): JSX.Element {
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
