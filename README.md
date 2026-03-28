# Vectis – Intelligent Vision Platform

## Overview

Vectis is an **Intelligent Vision Platform** designed to transform raw visual input (images, video streams, or camera feeds) into **structured, actionable insights** through AI-powered interpretation and orchestration.

At its core, Vectis acts as a **visual perception layer** for physical environments, enabling systems, applications, and agents to **see, understand, and act**.

Vectis bridges the gap between:
- Physical world events (captured via cameras)
- Digital systems (APIs, workflows, dashboards, agents)
- Decision-making (alerts, automation, analytics)

---

## Vision

To become the **default operating layer for machine vision**, enabling organisations and individuals to:
- Convert visual input into **decisions**
- Automate workflows based on **real-world observations**
- Build **vision-driven applications** without deep AI expertise

---

## Core Concept

Vectis follows a simple but powerful pipeline:

```
Capture → Interpret → Structure → Decide → Act
```

### 1. Capture

- Input sources:
  - IP cameras (PoE, RTSP streams)
  - Edge devices (e.g., Raspberry Pi + camera)
  - Uploaded images/videos
  - Live streams

### 2. Interpret

- AI models analyse visual data:
  - Object detection
  - Scene understanding
  - Text extraction (OCR)
  - Behaviour recognition
  - Contextual inference

### 3. Structure

- Convert raw AI output into:
  - Normalised events
  - Structured metadata
  - Time-series observations

### 4. Decide

- Apply logic:
  - Rules engine
  - Agent-based reasoning
  - Thresholds / anomaly detection

### 5. Act

- Trigger downstream actions:
  - Notifications
  - API calls
  - Workflow execution
  - Dashboard updates

---

## Key Features

### 1. Visual Intelligence Engine
- Modular AI pipeline for:
  - Detection (objects, people, events)
  - Classification
  - Tracking over time
- Pluggable models (BYO or platform-provided)

---

### 2. Event-Driven Architecture
- Every observation becomes an **event**
- Events can be:
  - Stored
  - Queried
  - Triggered upon

Example:
```json
{
  "timestamp": "2026-03-28T08:45:12Z",
  "source": "camera_entrance_1",
  "event_type": "person_detected",
  "confidence": 0.97,
  "metadata": {
    "bounding_box": [x, y, w, h],
    "direction": "entering"
  }
}
```

---

### 3. Edge + Cloud Hybrid Design

#### Edge (on-device)

* Real-time processing
* Low latency
* Reduced bandwidth usage

#### Cloud

* Aggregation
* Advanced analytics
* Model orchestration
* Historical storage

---

### 4. Agent Integration Layer

Vectis is designed to integrate with **AI agents** (e.g., in HelmOS or similar systems):

* Agents consume structured events
* Agents can:

  * Interpret context
  * Make decisions
  * Initiate workflows

Example:

* "If no movement detected for 2 hours → trigger security check agent"

---

### 5. Rules & Automation Engine

Users can define:

* Simple rules:

  * IF condition → THEN action
* Complex logic:

  * Multi-event correlation
  * Time-based conditions

---

### 6. Dashboard & Visualisation

* Real-time monitoring dashboards
* Event timelines
* Heatmaps / activity zones
* Alerts and notifications

---

### 7. Developer-Friendly API

REST / Event-based APIs for:

* Ingesting visual data
* Querying events
* Triggering workflows
* Integrating with external systems

---

## Example Use Cases

### 1. Smart Home / Personal Automation

* Detect when children arrive home
* Monitor activity patterns
* Trigger lighting, heating, or notifications

---

### 2. Security & Surveillance

* Intrusion detection
* Unusual behaviour recognition
* Automated alerting

---

### 3. Retail Analytics

* Foot traffic analysis
* Queue detection
* Customer movement tracking

---

### 4. Industrial / Energy Context (Highly Relevant)

* Monitor physical infrastructure (e.g., substations, plants)
* Detect anomalies or safety violations
* Track equipment usage visually

---

### 5. Personal Productivity (Sepia-style Integration)

* Capture receipts → auto-expense logging
* Capture whiteboards → structured notes
* Capture objects → classification and storage

---

## System Architecture (High-Level)

```
[Camera / Input Devices]
            ↓
     [Edge Processing Layer]
            ↓
     [Event Streaming Layer]
            ↓
     [Cloud Processing & Storage]
            ↓
   [Rules Engine / Agents Layer]
            ↓
 [Applications / Dashboards / APIs]
```

---

## Core Components

### 1. Capture Layer

* Camera integrations
* Stream ingestion (RTSP, HTTP)

### 2. Vision Processing Layer

* Model inference pipeline
* Image/video processing

### 3. Event Bus

* Message broker (e.g., SQS, Kafka)
* Decouples processing from actions

### 4. Storage Layer

* Event store (time-series)
* Object storage (images/videos)
* Metadata DB

### 5. Decision Layer

* Rules engine
* Agent orchestration

### 6. Interface Layer

* Web UI (Angular-based)
* API Gateway

---

## Design Principles

### 1. Event-First

Everything is an event. This ensures:

* Traceability
* Replayability
* Scalability

---

### 2. Modular AI

* Models are interchangeable
* Avoid vendor lock-in
* Support rapid evolution of AI capabilities

---

### 3. Edge-Optimised

* Minimise latency
* Reduce cloud dependency where needed

---

### 4. Developer-Centric

* Clear APIs
* Structured outputs
* Extensibility

---

### 5. Human-in-the-Loop

* Users can validate or override decisions
* Feedback improves models over time

---

## Future Vision

Vectis evolves into:

### 1. Visual Operating System Layer

* A foundational layer for any system needing "eyes"

### 2. Autonomous Vision Agents

* Agents that:

  * Monitor environments
  * Learn patterns
  * Act proactively

### 3. Integration with Digital Twins

* Combine:

  * Visual data
  * System data
  * Predictive models

---

## MVP Scope (Initial Version)

Focus on:

* Single camera input
* Basic object detection (people, motion)
* Event generation
* Simple rules engine
* Minimal dashboard
* API for event access

---

## Non-Goals (Initial Phase)

* Full multi-tenant enterprise platform
* Highly specialised industry models
* Complex multi-camera correlation

---

## Naming Rationale

**Vectis** (Latin):

* Meaning: *lever, pivot, or bar used to move something*
* Symbolises:

  * Turning vision into action
  * Leveraging perception for impact
  * A pivot point between observation and decision

---

## Tagline

**Intelligent Vision Platform**

---

## Summary

Vectis is not just a computer vision tool.

It is:

* A **platform**
* A **decision engine**
* A **bridge between physical reality and digital action**

It enables systems to move from:

> "Seeing" → to → "Understanding" → to → "Acting"

---
