import type { TuiPluginModule } from "@kilocode/plugin/tui"
import { createEffect, createSignal, onCleanup, type JSX } from "solid-js"

const PLUGIN_ID = "kilo-openrouter-vision"
const MARKER = "kilo-openrouter-vision"
const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

function Spinner(props: { label: string }): JSX.Element {
  const [frame, setFrame] = createSignal(0)
  const timer = setInterval(() => setFrame((value) => (value + 1) % FRAMES.length), 80)
  onCleanup(() => clearInterval(timer))
  return <span>{FRAMES[frame()]} {props.label}</span>
}

const plugin: TuiPluginModule = {
  id: PLUGIN_ID,
  async tui(api) {
    const [busy, setBusy] = createSignal<string | null>(null)

    api.event.on("tui.toast.show", ({ properties }) => {
      if (properties.title !== MARKER) return
      if (properties.message.startsWith("Describing")) {
        setBusy(properties.message)
      } else {
        setBusy(null)
      }
    })

    api.slots.register({
      order: 0,
      slots: {
        session_prompt_right: () => {
          const label = busy()
          return label ? <Spinner label={label} /> : null
        },
      },
    })
  },
}

export default plugin
