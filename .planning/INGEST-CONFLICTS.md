## Conflict Detection Report

### BLOCKERS (0)

### WARNINGS (1)

[WARNING] Competing AI Syllabus Import unit-structuring models across SPECs
  Found: docs/superpowers/plans/2026-11-05-class-wise-ai-syllabus-import.md (source: docs/superpowers/plans/2026-11-05-class-wise-ai-syllabus-import.md) creates separate `syllabus_units` per standard (Classes 6-12) via `aiSyllabusImportService.ts`, whereas docs/superpowers/specs/2026-11-07-ai-syllabus-import-design.md (source: docs/superpowers/specs/2026-11-07-ai-syllabus-import-design.md) and docs/superpowers/plans/2026-11-07-ai-syllabus-import.md (source: docs/superpowers/plans/2026-11-07-ai-syllabus-import.md) explicitly prohibit per-standard parent units and enforce a Single Parent Unit container via `aiSyllabusEngineService.ts`.
  Impact: Both are equal-precedence SPECs (locked: false, precedence: null); downstream planning cannot implement both unit models simultaneously without schema and UI conflict.
  → Confirm whether 2026-11-07-ai-syllabus-import-design.md supersedes 2026-11-05-class-wise-ai-syllabus-import.md, or set an explicit `precedence` override via `--manifest` before routing.

### INFO (1)

[INFO] Auto-resolved: ADR > SPEC on serverless pg.Pool max size
  Found: docs/designs/concepts_brief.md (source: docs/designs/concepts_brief.md, ADR) sets serverless Lambda `pg.Pool` `max` to `3`, while docs/designs/phase1_implementation_plan.md (source: docs/designs/phase1_implementation_plan.md, SPEC) and docs/designs/tnpsc_study_hub_architecture_roadmap.md (source: docs/designs/tnpsc_study_hub_architecture_roadmap.md, SPEC) specify `max: 2` (`1-2`).
  Note: Per `ADR > SPEC` precedence, ADR (`max: 3`) wins; both SPECs remain recorded in `constraints.md` for reference.
