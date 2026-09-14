import { expect, test } from "bun:test";

import {
  registerAutomationScenarios,
  registerCliCoreScenarios,
  registerCliFlagScenarios,
  registerDistArtifactScenarios,
} from "@tests/helpers/e2e-scenarios.ts";
import { createNodeSpawnCli, distExists } from "@tests/helpers/spawn-cli.ts";

const nodeOptions = {
  labelPrefix: "dist/cli.mjs — ",
  lenientAuthFailureExit: true,
  skip: !distExists,
  // SAFETY: The surrounding test or boundary has established the asserted contract.
} as const;

const spawnNode = createNodeSpawnCli();

registerCliFlagScenarios(spawnNode, nodeOptions);
registerDistArtifactScenarios(nodeOptions);
registerCliCoreScenarios(spawnNode, nodeOptions);
registerAutomationScenarios(spawnNode, nodeOptions);

test("test module loads", () => expect(true).toBe(true));
