# Vectis Deployment

## Environments

### Local Development

The local development environment runs primarily on the developer machine, with the Raspberry Pi camera reachable over the home LAN.

Core runtime:

- `src/backend` runs locally with Fastify and Prisma.
- `src/website` runs locally with Vite.
- `src/webapp` runs locally with Vite.
- PostgreSQL runs locally on `localhost:5432`.
- Image payloads are stored on the local filesystem.
- The Raspberry Pi camera remains on the LAN and is reached over SSH and HTTP.

Default local database settings:

- host: `localhost`
- port: `5432`
- user: `postgres`
- password: none
- default database: `vectis_dev`

Default `DATABASE_URL`:

```text
postgresql://postgres@localhost:5432/vectis_dev?schema=public
```

To prepare the local database:

1. Run `npm run db:create -w @vectis/backend`
2. Run `npm run prisma:generate -w @vectis/backend`
3. Run `npm run prisma:migrate:deploy -w @vectis/backend`

Recommended local startup:

1. Start PostgreSQL locally.
2. Start the backend with `npm run dev:backend`.
3. Start the website with `npm run dev:website`.
4. Start the webapp with `npm run dev:webapp`.
5. Run the Raspberry Pi camera service on the Pi and access it from the LAN.
6. Run the agent either on the Pi or on the developer machine against the Pi stream, depending on the scenario being tested.

Local deployment of the Pi camera service is automated through:

```text
./scripts/deploy_pi_camera.sh
```

Default local Pi target values:

- `PI_HOST=192.168.1.22`
- `PI_USER=ralfe`
- `PI_SERVICE_NAME=vectis-pi-camera`
- `PI_INSTALL_DIR=/opt/vectis/pi-camera`

For password-authenticated local testing, the script supports:

- `PI_PASSWORD`
- `PI_SUDO_PASSWORD`

The script builds the Pi camera service locally, uploads it over SSH, installs runtime dependencies on the Pi, installs a `systemd` unit, restarts the service, and verifies `http://127.0.0.1:8080/health` on the device.

### Production AWS

Production runs in AWS for the cloud components and on the home Raspberry Pi for the initial edge capture path.

Cloud runtime:

- Backend API on Amazon ECS with its image stored in ECR
- Marketing website on Amazon ECS with its image stored in ECR
- Webapp on Amazon ECS with its image stored in ECR
- PostgreSQL on Amazon RDS for PostgreSQL
- Application and database credentials in AWS Secrets Manager
- Image payloads in Amazon S3
- Image-processing worker in AWS Lambda, triggered by `ObjectCreated` events in S3

Public endpoints:

- `https://vectis-sense.ai/` and `https://www.vectis-sense.ai/` -> Marketing website
- `https://app.vectis-sense.ai/` -> Webapp
- `https://api.vectis-sense.ai/` -> Backend API

The production deployment is designed around the Serverless Framework, with the AWS deployment definitions and helper scripts located under `/cicd/serverless`.

## CI/CD Reference

The detailed CI/CD concept, including promotion flow, Serverless layout, and Raspberry Pi deployment strategy, is documented in `docs/cicd_concept.md`.

## Production Deployment Commands

The implemented production deployment entrypoint is:

```text
./cicd/serverless/scripts/deploy-prod.sh
```

This script:

1. deploys or updates the shared AWS foundation stack
2. builds and pushes the backend, website, and webapp images to ECR
3. runs Prisma migrations against the production RDS database
4. deploys the ECS services and the S3-triggered Lambda worker
5. runs smoke checks against the public production endpoints

Required environment variables:

- `AWS_REGION`
- `HOSTED_ZONE_ID`
- `ACM_CERTIFICATE_ARN`

Common optional variables:

- `STACK_PREFIX` defaults to `vectis`
- `STAGE` defaults to `prod`
- `ROOT_DOMAIN` defaults to `vectis-sense.ai`
- `DATABASE_NAME` defaults to `vectis_prod`
- `DATABASE_USERNAME` defaults to `vectis`
- `IMAGE_TAG` defaults to the current git SHA

When images have already been published, deployment can reuse them by setting:

```text
SKIP_IMAGE_BUILD=1 IMAGE_TAG=<tag> ./cicd/serverless/scripts/deploy-prod.sh
```
