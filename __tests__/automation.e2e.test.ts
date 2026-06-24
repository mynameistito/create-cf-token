import { registerAutomationScenarios } from "./helpers/e2e-scenarios.ts";
import { createBunSpawnCli } from "./helpers/spawn-cli.ts";

registerAutomationScenarios(createBunSpawnCli());
