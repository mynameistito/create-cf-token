import { registerCliCoreScenarios } from "./helpers/e2e-scenarios.ts";
import { createBunSpawnCli } from "./helpers/spawn-cli.ts";

registerCliCoreScenarios(createBunSpawnCli(), { labelPrefix: "CLI e2e — " });
