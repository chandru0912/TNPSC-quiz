# Document Synthesis Summary

## Classification Counts
- **Total documents:** 8
- **ADR:** 1
- **SPEC:** 7
- **PRD:** 0
- **DOC:** 0
- **UNKNOWN:** 0

## Decisions
- **Locked decisions:** 0
- **Proposed decisions:** 5 (all from `docs/designs/concepts_brief.md`)
  - Hybrid Architecture: Vercel Frontend/API + Persistent Worker Container
  - Database Platform: Keep Neon PostgreSQL with Pooled Connections (`-pooler`)
  - MCQ Translation Delivery: Pre-translate on Publish + Small Synchronous Fallback
  - Syllabus Single Source of Truth: PostgreSQL Write-Master + Edge-Cached Snapshots
  - Admin Modularization & Root Cleanup

## Requirements
- **Extracted requirements:** 0 (no PRD documents in ingest set)

## Constraints
- **Total constraint blocks:** 9 (across 7 SPECs)
  - `nfr`: 4
  - `api-contract`: 3
  - `schema`: 1
  - `protocol`: 1

## Context Topics
- **Context entries:** 0 (no DOC documents in ingest set)

## Conflicts Summary
- **BLOCKERS:** 0
- **WARNINGS:** 1 (Competing AI Syllabus Import unit-structuring models between `2026-11-05-class-wise-ai-syllabus-import.md` and `2026-11-07-ai-syllabus-import-design.md` / `2026-11-07-ai-syllabus-import.md`)
- **INFO:** 1 (Auto-resolved `ADR > SPEC` on serverless `pg.Pool` `max` size)
- **Detail report:** `d:/moonzoro/TNPSC quiz/.planning/INGEST-CONFLICTS.md`

## Intel Files
- Decisions: `d:/moonzoro/TNPSC quiz/.planning/intel/decisions.md`
- Requirements: `d:/moonzoro/TNPSC quiz/.planning/intel/requirements.md`
- Constraints: `d:/moonzoro/TNPSC quiz/.planning/intel/constraints.md`
- Context: `d:/moonzoro/TNPSC quiz/.planning/intel/context.md`
