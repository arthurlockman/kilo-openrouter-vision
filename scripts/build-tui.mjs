import { transformAsync } from "@babel/core"
import { readFileSync, rmSync, writeFileSync } from "node:fs"
import ts from "@babel/preset-typescript"
import solid from "babel-preset-solid"

// Compile src/tui.tsx with babel-preset-solid (generate: "universal") so
// JSX interpolations become reactive accessors against @opentui/solid's
// runtime — esbuild's automatic JSX only creates static nodes, which is why
// signal-driven UI (the spinner frames) never repainted. The transformed code
// is written to dist and then bundled by `build:tui`.
const source = readFileSync(new URL("../src/tui.tsx", import.meta.url), "utf8")
const { code } = await transformAsync(source, {
  filename: "src/tui.tsx",
  configFile: false,
  babelrc: false,
  presets: [
    [solid, { moduleName: "@opentui/solid", generate: "universal" }],
    [ts],
  ],
})

if (!code) {
  throw new Error("babel transform produced no output for src/tui.tsx")
}

rmSync(new URL("../dist/tui.esm.js", import.meta.url), { force: true })
writeFileSync(new URL("../dist/tui.esm.js", import.meta.url), code)
console.log("built dist/tui.esm.js")
