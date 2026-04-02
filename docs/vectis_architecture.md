# Vectis Architecture

## Overview

Vectis is currently set up as a small workspace-based MVP scaffold that mirrors the product idea in the README:

Environment model:

- Development runs locally on the developer machine.
- Production runs in AWS.

The production system is intended to use dedicated subdomains:

- `https://vectis-sense.ai` and `https://www.vectis-sense.ai` for the marketing website
- `https://app.vectis-sense.ai` for the webapp
- `https://api.vectis-sense.ai` for the backend API

- `src/backend`
  A Node.js and Fastify API that exposes platform overview resources plus tenant-scoped CRUD for premises and premises cameras, backed by Prisma ORM.
- `src/pi-camera`
  A Raspberry Pi edge capture service that wraps `rpicam-vid` and exposes a pullable HTTP MPEG-TS stream for the Vectis agent.
- `src/agent`
  A Python on-prem video gateway agent that connects to the local camera stream, performs deterministic motion detection, queues outbound media uploads, and emits telemetry and health signals without running any AI at the edge.
- `src/webapp`
  A React-based operator dashboard for monitoring camera health, structured events, and automation rules.
- `src/website`
  A React-based marketing website focused on the Capture -> Interpret -> Structure -> Decide -> Act story.
- `src/shared`
  Shared TypeScript contracts and seeded sample data used by all three surfaces.

This keeps the initial platform event-first and easy to iterate on while creating a clean path toward the fuller architecture described in the product vision.

The target deployment model is now split into:

- local development on the developer machine, backed by local PostgreSQL and local filesystem media storage
- AWS production for the cloud plane, using ECS, ECR, RDS PostgreSQL, Secrets Manager, S3, and an S3-triggered Lambda worker
- a home Raspberry Pi edge device that remains outside AWS and is deployed independently over SSH

## Current MVP Runtime Shape

### Backend

- Fastify API
- Prisma-backed PostgreSQL persistence with versioned migrations under `src/backend/prisma/migrations`
- Tenant-scoped CRUD endpoints for premises, nested cameras, and on-prem agents
- Ingestion endpoints for camera health reports and filtered frame uploads from agents
- Local filesystem frame persistence in development, with the same abstraction ready to move to S3 in AWS
- Request context that can derive tenant and user identity from headers today and JWT claims later
- Seeded overview, events, rules, and legacy dashboard camera resources still available for local development

### Pi Camera Edge Service

- Fastify-based HTTP service intended for Raspberry Pi 5 + Camera Module 3 deployments
- Starts `rpicam-vid` on demand and exposes an MPEG-TS stream over HTTP
- Designed so an on-site Vectis agent can pull the feed and forward it to cloud ingestion

### On-Prem Video Gateway Agent

- Python-based runtime designed for Raspberry Pi OS and containers
- Pulls a local stream, extracts low-rate preview frames, and performs lightweight motion detection only
- Maintains a short ring buffer for pre-trigger context
- Uses a local disk-backed queue to survive backend outages and retry outbound uploads
- Exposes local `/health`, `/livez`, `/readyz`, and `/metrics` endpoints for operational visibility

### Webapp

- Control-center style dashboard UI
- Camera health, event feed, and rules views
- Shared contracts so the UI can move from mock data to API-backed data with minimal churn

### Marketing Website

- Branded landing page inspired by the Vectis logo palette
- Messaging aligned to the product vision and MVP scope

## Target Production Runtime Shape

### Cloud Plane

- Amazon ECS Fargate services for backend, website, and webapp
- Amazon ECR as the image registry for those three deployable containers
- Amazon RDS PostgreSQL in private subnets for relational state
- AWS Secrets Manager for database credentials and application secrets
- Amazon S3 for raw and processed image payloads
- Lambda `image-processing-worker` triggered by new S3 objects
- Application Load Balancer with host-based routing for website, webapp, and backend

### Edge Plane

- Raspberry Pi camera service remains on the home LAN
- Production edge deployment is performed independently from AWS deployment
- SSH is the initial deployment transport to the Pi
- The Pi can run the stable production edge services while the developer machine runs local development services

## Planned Next Structural Steps

1. Replace the temporary header-based tenant context with validated JWT-backed user derivation and authorization policies.
2. Promote the local PostgreSQL-backed Prisma deployment model to AWS RDS for production environments.
3. Implement the Serverless-based AWS deployment layout under `/cicd/serverless`.
4. Add the S3-triggered image-processing worker and connect its outputs back into the platform data model.
5. Wire the webapp to the new premises and premises camera endpoints instead of relying on shared sample data.
6. Add remote configuration sync and downstream frame-processing pipelines on top of the stored frame metadata and object storage payloads.

## Diagrams

- Package diagram: `docs/vectis_package_diagram.puml`
- ERD: `docs/vectis_erd.puml`
- Physical prototype reference: `docs/prototype_camera_architecture.puml`
- Agent implementation reference: `src/agent/README.md`
- Deployment concept: `docs/cicd_concept.md`
