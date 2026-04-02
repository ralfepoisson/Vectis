import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { readCameraServiceConfig } from "./config";
import {
  renderPiCameraEnvironmentFile,
  renderPiCameraSystemdUnit
} from "./deploy-config";

async function main() {
  const [envOutputPath, serviceOutputPath] = process.argv.slice(2);

  if (!envOutputPath || !serviceOutputPath) {
    throw new Error(
      "Usage: node dist/render-deploy-files.js <env-output-path> <service-output-path>"
    );
  }

  const config = readCameraServiceConfig(process.env);
  const installDir = process.env.DEPLOY_INSTALL_DIR ?? "/opt/vectis/pi-camera";
  const serviceName = process.env.DEPLOY_SERVICE_NAME ?? "vectis-pi-camera";
  const serviceUser = process.env.DEPLOY_USER ?? "ralfe";
  const serviceGroup = process.env.DEPLOY_GROUP ?? serviceUser;
  const environmentFilePath =
    process.env.DEPLOY_ENV_FILE_PATH ?? `${installDir}/${serviceName}.env`;
  const nodeBinary = process.env.DEPLOY_NODE_BINARY ?? "/usr/bin/node";

  await mkdir(path.dirname(envOutputPath), { recursive: true });
  await mkdir(path.dirname(serviceOutputPath), { recursive: true });

  await writeFile(envOutputPath, `${renderPiCameraEnvironmentFile(config)}\n`, "utf8");
  await writeFile(
    serviceOutputPath,
    `${renderPiCameraSystemdUnit({
      environmentFilePath,
      group: serviceGroup,
      installDir,
      nodeBinary,
      serviceName,
      user: serviceUser
    })}\n`,
    "utf8"
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
