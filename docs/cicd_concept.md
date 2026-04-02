# Vectis CI/CD Concept

## Goals

This concept separates Vectis into two deployment planes:

- a local development plane for rapid iteration on the developer machine
- a production cloud plane in AWS, with the camera edge remaining on the home Raspberry Pi initially

It also separates cloud deployment from edge deployment because the Raspberry Pi is reachable from the local LAN, not directly from AWS.

## Target Runtime Model

### Local Development

Local development should optimize for fast feedback and low ceremony:

- `src/backend`, `src/website`, and `src/webapp` run directly from the workspace on the developer machine
- local PostgreSQL backs Prisma migrations and API development
- local filesystem storage is used for uploaded image data
- the Raspberry Pi camera service runs on the Pi and is consumed over the LAN
- the agent can run on the developer machine during development to avoid disturbing the production edge process on the Pi

Recommended responsibility split:

- Raspberry Pi: `pi-camera` service and, when needed, the production agent service
- Developer machine: local backend, website, webapp, and optionally a dev-mode agent pointed at the Pi stream

This avoids two environments competing for exclusive camera hardware access.

### Production in AWS

Production should run as a small but production-shaped AWS stack:

- Amazon ECS services for `backend`, `website`, and `webapp`
- Amazon ECR repositories for the three container images
- Amazon RDS for PostgreSQL in private subnets
- AWS Secrets Manager for database credentials and app secrets
- Amazon S3 for raw and processed image assets
- AWS Lambda `image-processing-worker` triggered by new S3 objects
- a shared VPC, security groups, IAM roles, and load-balancing layer

Recommended ingress pattern:

- one internet-facing Application Load Balancer
- host-based routing to three ECS services:
  - `vectis-sense.ai` and `www.vectis-sense.ai` -> website service
  - `app.vectis-sense.ai` -> webapp service
  - `api.vectis-sense.ai` -> backend service

Recommended compute model:

- ECS Fargate for the three long-running containers
- Lambda for bursty asynchronous image-processing tasks

Recommended storage model:

- RDS stores relational platform metadata
- S3 stores raw frames, processed derivatives, and long-lived media payloads
- the backend stores S3 object keys and related metadata in PostgreSQL

## Raspberry Pi Deployment Strategy

The Raspberry Pi is special because it is simultaneously part of the dev story and the initial production story.

Recommended approach:

1. Treat the Pi as an edge target outside AWS.
2. Keep SSH as the deployment transport from the developer machine.
3. Run `pi-camera` as a stable systemd-managed service on the Pi.
4. Run the production `agent` on the Pi with production configuration.
5. Run a development `agent` on the developer machine when local testing is needed.

Why this split works well:

- the production edge path remains continuously available
- local UI and backend work can proceed without replacing the Pi runtime
- no inbound connectivity from AWS to the home LAN is required

If later the Pi must be deployed automatically from CI, add a self-hosted GitHub Actions runner on the developer machine or on another always-on host in the same LAN. Until then, Pi deployment should be a controlled CD step initiated from the developer machine.

## CI/CD Flow

### 1. Pull Request CI

On every pull request:

1. Install Node.js and Python toolchains.
2. Run workspace tests:
   - `npm test`
   - Python agent tests
3. Run workspace builds:
   - `npm run build`
   - Python packaging or import smoke checks for the agent
4. Build the three cloud container images:
   - backend
   - website
   - webapp
5. Package the Serverless services from `/cicd/serverless`.

Purpose:

- catch application regressions early
- prove the AWS deployment descriptors still synthesize correctly
- keep image build failures out of the release branch

### 2. Main Branch Integration

On merge to `main`:

1. Re-run tests and builds in a release configuration.
2. Build immutable container images tagged with:
   - git SHA
   - branch or release tag
3. Push images to ECR.
4. Package the Serverless stack from `/cicd/serverless`.
5. Publish deployment artifacts and metadata.

Purpose:

- create one auditable release artifact set
- ensure production deployments always consume immutable image tags

### 3. Production Deployment

Production deployment should be approval-gated.

Recommended flow:

1. Resolve the target image tags from the release artifacts.
2. Deploy the shared AWS foundation if needed.
3. Run Prisma migrations against the production RDS database.
4. Deploy or update ECS services for backend, website, and webapp through Serverless.
5. Deploy or update the S3-triggered Lambda worker through Serverless.
6. Run smoke checks against:
   - `https://vectis-sense.ai`
   - `https://app.vectis-sense.ai`
   - `https://api.vectis-sense.ai/health` or equivalent

Important sequencing:

- migrate the database before shifting backend traffic to a new version when the schema change is backward-compatible
- use backward-compatible migrations when zero-downtime rollout matters
- deploy the Lambda worker after the target S3 bucket and IAM permissions exist

### 4. Edge Deployment

Edge deployment should be independent from AWS release deployment.

Recommended flow:

1. Build or package the `pi-camera` and `agent` artifacts.
2. From the developer machine, copy artifacts and config to the Pi via SSH.
3. Restart the corresponding systemd units.
4. Verify Pi-local health endpoints.
5. Verify the production backend sees fresh health telemetry.

This should be a separate workflow because:

- the Pi is not in AWS
- the Pi is only directly reachable on the home LAN
- edge rollout risk is operationally different from cloud rollout risk

## Recommended Repository Layout

The AWS deployment assets should live under `/cicd/serverless`.

Recommended layout:

```text
/cicd/serverless/
  serverless-compose.yml
  foundation/
    serverless.yml
  backend/
    serverless.yml
  website/
    serverless.yml
  webapp/
    serverless.yml
  image-worker/
    serverless.yml
  scripts/
    deploy-foundation.sh
    deploy-prod.sh
    migrate-prod.sh
```

Suggested responsibilities:

- `foundation`: VPC, subnets, security groups, ECR repos, S3 bucket, Secrets Manager bindings, RDS, ALB, DNS and certificates
- `backend`: ECS task definition, ECS service, target group, backend-specific secrets and environment wiring
- `website`: ECS task definition, ECS service, host routing for root domains
- `webapp`: ECS task definition, ECS service, host routing for `app.`
- `image-worker`: Lambda function, S3 event binding, worker IAM policies

Use `serverless-compose.yml` to orchestrate service deployment order and cross-stack outputs.

The implemented helper scripts are:

- `/cicd/serverless/scripts/deploy-foundation.sh`
- `/cicd/serverless/scripts/build-and-push-images.sh`
- `/cicd/serverless/scripts/migrate-prod.sh`
- `/cicd/serverless/scripts/deploy-prod.sh`
- `/cicd/serverless/scripts/smoke-check-prod.sh`

## Secrets and Configuration Model

### Local Development

Store local configuration in environment files that are not committed:

- backend database URL
- local storage paths
- development API base URLs
- optional Pi SSH host and user

### Production AWS

Store secrets in AWS Secrets Manager:

- RDS credentials
- backend application secrets
- any JWT signing or third-party API secrets

Inject them into ECS task definitions and Lambda through:

- task execution roles and task roles
- Lambda execution role
- Serverless variable resolution and environment mapping

Do not bake environment secrets into container images.

## Image Processing Flow

Recommended production flow:

1. The edge agent uploads image data to S3, either directly or through the backend.
2. The backend records metadata in PostgreSQL, including the S3 object key.
3. S3 emits an `ObjectCreated` event.
4. Lambda `image-processing-worker` processes the object.
5. The worker writes derived outputs back to S3 and/or sends structured metadata to the backend.

Keep the worker stateless and idempotent so retries are safe.

## Release and Promotion Principles

- Use immutable image tags for every production deployment.
- Keep infrastructure deployment declarative in Serverless.
- Separate cloud release from Raspberry Pi release.
- Prefer manual approval before production rollout.
- Keep database migrations explicit and auditable.
- Make health checks first-class in both ECS services and Pi services.

## Recommended GitHub Actions Workflow Set

Suggested workflow split:

- `ci.yml`: test, lint if added later, and build on pull requests
- `release.yml`: build and push ECR images on merges to `main`
- `deploy-prod.yml`: approval-gated Serverless deployment to AWS production
- `deploy-edge.yml`: manually triggered Pi deployment from a self-hosted runner or the developer machine

The repository now includes:

- `.github/workflows/release.yml`
- `.github/workflows/deploy-prod.yml`

## Risks and Constraints

### Shared Physical Camera

One physical Raspberry Pi camera serving both development and production is acceptable initially, but it creates coupling:

- a Pi outage affects both environments
- hardware changes can disrupt production while testing
- full isolation between dev and prod is not possible

This is manageable for the current stage, but a second Pi or a replayable test video source would remove the coupling later.

### Network Reachability

AWS cannot assume direct reachability into the home LAN.

This means one of the following must be true for automated edge deployment:

- use a self-hosted runner on the LAN
- use a secure outbound tunnel or remote management layer later
- keep edge deployment as a developer-initiated SSH process for now

The third option is the simplest starting point and matches the current setup best.
