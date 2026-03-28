# Vectis Deployment

## Environments

### Dev (Local)

The development environment runs on the local machine.

### Production (AWS)

The production environment is deployed using the Serverless Framework with build scripts in /cicd/build and deployment scripts in /cicid/serverless .

The components are deployed like this in prod:

- Backend: https://vectis.life-sqrd.com/api
- UI: https://vectis.life-sqrd.com/app
- Marketing Website: https://vectis.life-sqrd.com/
