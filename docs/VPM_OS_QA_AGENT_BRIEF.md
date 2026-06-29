# VPM-OS QA Agent Brief

## Purpose

This brief gives future QA agents a consistent framework for auditing VPM-OS across layout, workflow clarity, staff usability, safety guardrails, and the client-review lifecycle.

The QA agent's role is to test the product as an internal staff workflow system, identify risks or usability issues, and organise findings into practical, safe, PR-sized fixpacks.

## What VPM-OS Is

VPM-OS is the internal operating system and web application for Visa Pass Migration. It manages the potential client lifecycle from public registration through intake review, lead rating, C.L.E.A.R preparation, senior review, consultation readiness, CSA/deposit, and onboarding.

The system exists to help VPM staff understand each potential client's current state, review the quality and completeness of the case, prepare internal assessment material, coordinate next actions, and maintain a traceable audit history.

## Who Uses VPM-OS

VPM-OS is used by VPM staff, including:

- Admin and intake staff who review new registrations and prepare client records for internal assessment.
- Senior reviewers who assess case quality, risk, readiness, and next-step suitability.
- Australian team members who may review consultation readiness, compliance concerns, and operational status.
- Business owner and admin users who need oversight of the pipeline, workflow health, staff actions, and client-readiness lifecycle.

## Core Workflow Stages

The QA agent should verify that the product clearly supports and communicates the following workflow stages:

1. Registration Submitted
2. Initial Intake Review
3. Lead Rating Confirmed
4. C.L.E.A.R Preparation
5. Senior Review
6. Consultation Invite
7. Consultation Completed
8. CSA Issued
9. CSA Signed + Deposit Paid
10. Client Onboarded

## QA Agent Inspection Areas

The QA agent should inspect the following areas for layout, clarity, workflow behaviour, staff usability, and safety:

- Public home page
- Public registration/intake form
- Staff login
- Staff dashboard
- Review queue
- Client Review Workspace
- Workflow Stage Snapshot
- Quick Workflow Movement Controls
- Case Quality Snapshot
- Lead Quality Rating
- C.L.E.A.R section
- Internal Review Actions
- Communications tab
- Consultation tab
- Staff Tasks tab
- Audit Trail

For each area, the QA agent should consider whether staff can quickly understand what has happened, what needs to happen next, what actions are safe to take, and what information is internal-only.

## Safety Guardrails

The QA agent must check and preserve the following safety guardrails:

- No automatic client communication is triggered by staff workflow actions.
- Request More Information is internal-only.
- Escalate for Risk Review is internal-only.
- Consultation Invite is readiness-only and does not send an invitation.
- C.L.E.A.R remains internal unless explicitly authorised.
- Internal notes and staff-only artefacts are not exposed to clients.
- No migration outcome, visa success, approval likelihood, or guaranteed result is promised.
- No real client personally identifiable information should be used in testing.
- Synthetic or test data only should be used during QA.

If any behaviour appears to send client communications, expose internal material, weaken staff-only controls, or imply guaranteed migration outcomes, the QA agent should treat it as a serious safety issue.

## Issue Severity Levels

Use the following severity levels when reporting issues.

### Critical

A Critical issue includes any of the following:

- Client communication risk.
- Internal material exposed to clients.
- Authentication or role-based access control issue.
- Data integrity issue.
- Broken registration flow.
- Broken staff login.
- Broken core workflow.

### High

A High issue includes any of the following:

- Confusing workflow movement.
- Excessive scrolling required for key staff actions.
- Missing feedback after staff actions.
- Skipped approval gate.
- Staff may misunderstand the client's stage, status, or next required action.

### Medium

A Medium issue includes problems with:

- Wording.
- Layout.
- Readability.
- Polish.
- Staff-training clarity.

### Low

A Low issue is a cosmetic nice-to-have or non-urgent cleanup that does not materially affect workflow safety, staff understanding, or client lifecycle management.

## What the QA Agent Should Report

For each issue, the QA agent should report:

- Page
- Section
- Problem
- Expected behaviour
- Severity
- Risk level
- Screenshot reference, if available
- Business reason
- Acceptance criteria

A good issue report should explain both the visible product problem and why it matters to VPM operations. Where possible, include enough detail for Codex or another implementer to reproduce and fix the issue without guessing.

## Fixpack Grouping

QA findings should be grouped into safe, PR-sized fixpacks. Prefer small, focused fixpacks that reduce implementation risk and make review easier.

Suggested grouping categories:

- Copy/layout-only fixes
- Feedback/loading-state fixes
- Workflow logic fixes
- Safety/compliance guardrail fixes
- Larger product questions that need owner clarification

Do not mix high-risk workflow or safety changes with cosmetic copy changes unless the product owner explicitly approves the combined scope.

## Agent Roles

Use the following role model when coordinating work:

- Claude = product manager / UX issue organiser.
- Codex = code implementer / PR creator.
- QA Agent = tester / workflow auditor.
- Joe / VPM owner = final product owner and staff reality filter.

The QA Agent should focus on testing and workflow auditing, not on making product decisions that require owner judgement. Product ambiguities should be escalated to Joe / the VPM owner.

## Testing Checklist

The QA agent should verify that:

- Staff can understand where the potential client is in the workflow.
- Staff can see the next action.
- Important buttons show loading, success, and error feedback.
- Audit trail records staff actions.
- No duplicate audit entries are created for no-change actions.
- No client communication is sent automatically.
- Layout is clean and premium.
- Staff-facing labels are plain English and not raw database labels.

## Documentation-Only Guardrails

For documentation-only work related to this brief:

- Do not change application code.
- Do not change the Prisma schema.
- Do not change auth or RBAC.
- Do not touch environment variables or secrets.
- Do not add dependencies.
- Do not alter existing docs except linking to this document if obviously appropriate.
