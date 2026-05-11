import type { OpenClawPluginApi } from "./api.js";
import { __testing, createPlugin } from "./src/plugin.js";

export default {
  id: "intention-hint",
  name: "Intention Hint",
  description:
    "Pre-scans user intent before replies and injects routing hints via before_prompt_build hook.",
  register(api: OpenClawPluginApi) {
    const plugin = createPlugin(api);
    plugin.register(api);
  },
};

export { __testing };
