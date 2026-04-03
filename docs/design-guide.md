# Vectis Design Guide

## Purpose

This guide defines the interaction and visual rules for the Vectis application UI in [`/Users/ralfe/Dev/Vectis/src/webapp`](/Users/ralfe/Dev/Vectis/src/webapp).

The goal is a control-room product that feels calm, deliberate, and operational rather than consumer-oriented.

## Core Principles

- Prefer structured workflows over crowded dashboards.
- Keep creation flows out of the main editing surface.
- Use a consistent left-to-right management pattern: choose context, choose asset, edit details.
- Reserve the main content area for editing, review, and state transitions.
- Surface feedback through transient toast notifications instead of inline banners.

## Interaction Rules

### Creation

- Never place create forms directly in the main content area.
- New entities must be created through a `+ <Object>` action button that opens a modal.
- Creation modals should contain only the fields required to establish the record.
- After successful creation, select the newly created record and return focus to the main workflow.

### Editing

- The main editor area is for updating the currently selected entity only.
- A selection should always be visually obvious in the left or middle rail.
- Editing forms should be stable in layout so users do not lose orientation when switching between premises, agents, and cameras.

### Navigation

- Use a top horizontal navigation bar for primary navigation.
- The logo belongs at the far left.
- Primary actions and user/account controls belong at the far right.
- `Admin` is only shown when the authenticated user is an admin.
- The profile affordance should use the current username or display name rather than a generic label.

### Notifications

- Success, error, and informational feedback should use toast notifications.
- Toasts should appear in the top-right area on desktop.
- Avoid inline alert blocks in page content except for auth-only fallback states before the main app is available.

## Layout Model

- Top navigation spans the page width.
- The main premises workspace uses three columns:
- left rail: premises list
- middle rail: agents then cameras for the selected premises
- main area: editor for the selected premises, agent, or camera

On narrow screens:

- collapse the three-column layout into a vertical stack
- keep the same ordering: premises, assets, editor

## Color System

Primary palette:

- `--brand: #1d5b7d`
- `--brand-strong: #163f57`
- `--accent: #7b9c52`
- `--text: #132534`
- `--muted: #65727d`

Surface palette:

- `--bg: #f4f6f3`
- `--bg-accent: #e6ece6`
- `--surface: rgba(255, 255, 255, 0.9)`
- `--surface-strong: #ffffff`
- `--surface-dark: #153447`
- `--line: rgba(24, 45, 56, 0.12)`

Feedback palette:

- success toast: `#eff8e5`
- error toast: `#fff0ec`
- danger action accent: `#ae5b53`

Guidance:

- Use blue-green and slate tones as the primary identity.
- Use olive as a supporting accent, not as the dominant color.
- Avoid bright, saturated warning colors unless tied to a specific alert state.
- Prefer depth through layered surfaces and shadow, not heavy borders.

## Typography

- Headings: `Space Grotesk`
- Body: `IBM Plex Sans`

Guidance:

- Headings should feel architectural and deliberate.
- Body copy should stay compact and operational.
- Avoid long paragraphs in management screens.

## Components

### Buttons

- Primary buttons are for create and save actions.
- Secondary buttons are for contextual add actions inside rails.
- Text buttons are for dismiss, close, or lightweight controls.

### Panels

- Use rounded panel containers with soft borders and layered shadows.
- Rails should feel lighter and denser than the main editor panel.
- The editor panel should have the most breathing room.

### Modals

- Modals should be wide enough for two-column forms on desktop.
- Keep the title and close action in a stable header row.
- Do not place unrelated navigation inside modals.

### Lists

- Each list row should be fully clickable as a selection target.
- Show one strong label and one muted metadata line.
- The selected item should use a soft filled highlight rather than a harsh border-only state.

## Accessibility

- All interactive controls must have accessible names.
- Dialogs must use `role="dialog"` and `aria-modal="true"`.
- Toast notifications should be announced through a live region.
- Do not rely on color alone to communicate selection or status.

## Implementation Notes

- Keep runtime styling values in CSS custom properties.
- Prefer reusable presentational patterns over one-off page-specific styling.
- When adding new pages, start from these navigation, modal, toast, and panel rules before introducing new patterns.
