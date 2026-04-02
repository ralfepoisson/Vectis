# Serverless Deployment Layout

This directory contains the Serverless Framework deployment descriptors and helper scripts for the AWS production environment.

The intended structure is:

```text
/cicd/serverless/
  serverless-compose.yml
  foundation/
  backend/
  website/
  webapp/
  image-worker/
  scripts/
```

See `docs/cicd_concept.md` for the deployment responsibilities of each service.

The primary production deployment command is:

```text
./cicd/serverless/scripts/deploy-prod.sh
```

Required environment variables:

- `AWS_REGION`
- `HOSTED_ZONE_ID`
- `ACM_CERTIFICATE_ARN`

Common optional variables:

- `STACK_PREFIX`
- `STAGE`
- `ROOT_DOMAIN`
- `DATABASE_NAME`
- `DATABASE_USERNAME`
- `IMAGE_TAG`

To deploy already-published images without rebuilding them:

```text
SKIP_IMAGE_BUILD=1 IMAGE_TAG=<tag> ./cicd/serverless/scripts/deploy-prod.sh
```
