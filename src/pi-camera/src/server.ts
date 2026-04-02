import { buildApp } from "./app";
import { readCameraServiceConfig } from "./config";

const config = readCameraServiceConfig();
const app = buildApp({ config });

app
  .listen({
    host: config.host,
    port: config.port
  })
  .then(() => {
    console.log(
      `Vectis Pi camera streamer listening on http://${config.host}:${config.port}${config.streamPath}`
    );
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
