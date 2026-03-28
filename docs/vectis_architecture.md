# Vectis Architecture

## Overview

Vectis is currently set up as a small workspace-based MVP scaffold that mirrors the product idea in the README:

- `src/backend`
  A Node.js and Fastify API that exposes platform overview, camera, event, and rules resources.
- `src/webapp`
  A React-based operator dashboard for monitoring camera health, structured events, and automation rules.
- `src/website`
  A React-based marketing website focused on the Capture -> Interpret -> Structure -> Decide -> Act story.
- `src/shared`
  Shared TypeScript contracts and seeded sample data used by all three surfaces.

This keeps the initial platform event-first and easy to iterate on while creating a clean path toward the fuller architecture described in the product vision.

## Current MVP Runtime Shape

### Backend

- Fastify API
- Seeded platform resources for local development
- Ready for future persistence, auth, broker, and worker integration

### Webapp

- Control-center style dashboard UI
- Camera health, event feed, and rules views
- Shared contracts so the UI can move from mock data to API-backed data with minimal churn

### Marketing Website

- Branded landing page inspired by the Vectis logo palette
- Messaging aligned to the product vision and MVP scope

## Planned Next Structural Steps

1. Replace seeded backend resources with Postgres-backed persistence and Prisma migrations.
2. Add broker and worker packages for asynchronous event fan-out and downstream action execution.
3. Introduce authentication and authorization once the user flows are defined.
4. Wire the webapp to the backend API instead of shared sample data once the persistence contract settles.

## Diagrams

- Package diagram: `docs/vectis_package_diagram.puml`
- ERD: `docs/vectis_erd.puml`
- Physical prototype reference: `docs/prototype_camera_architecture.puml`
