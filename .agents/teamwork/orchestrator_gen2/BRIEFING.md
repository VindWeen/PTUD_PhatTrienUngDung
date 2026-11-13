# BRIEFING — 2026-11-12T15:59:30Z

## Mission
Orchestrate the comprehensive refactoring into Smart Achievement Vault & Career Assistant. M1 & M2 complete. Driving Milestone 3 (Backend Extended: KPI, CV, Calendar, Unit AI Scan) -> M4 -> M5.

## 🔒 My Identity
- Archetype: teamwork_orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung
- State folder: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\orchestrator_gen2
- Original parent: parent
- Original parent conversation ID: cdc47539-2a72-4e2d-b601-97801d182519

## 🔒 My Workflow
- **Pattern**: Project
- **Scope document**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md
1. **Decompose**: Survey and decomposition complete. 5 milestones in PROJECT.md.
2. **Dispatch & Execute**: Delegate each milestone to a sub-orchestrator.
3. **On failure**: Retry -> Replace -> Skip -> Redistribute -> Redesign
4. **Succession**: At 16 spawns, write handoff.md, spawn successor
- **Work items**:
  1. Survey & Initial Codebase Mapping [done]
  2. Milestone Decomposition & PROJECT.md [done]
  3. Database Schema & Migration Execution (M1) [done]
  4. E2E Test Suite Track [done]
  5. Backend Core Modules (M2) [done - Gate PASS]
  6. Backend Extended Modules (M3) [in-progress]
  7. Frontend Modernization & Routing (M4) [pending]
  8. Final E2E Suite Pass & Adversarial Verification (M5) [pending]
- **Current phase**: 2 (Dispatch & Execute)
- **Current focus**: Milestone 3 Sub-Orchestrator execution

## 🔒 Key Constraints
- NEVER write, modify, or create source code files directly.
- NEVER run build/test commands yourself — require workers to do so.
- NEVER investigate or explore the problem at the code level — dispatch Explorers for technical investigation.
- You MAY use file-editing tools ONLY for metadata/state files (.md) in your .agents/teamwork/ folder.
- Follow Project Pattern strictly.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.
- Binary veto on Auditor Integrity Violation.

## Current Parent
- Conversation ID: cdc47539-2a72-4e2d-b601-97801d182519
- Updated: 2026-11-12T14:52:30Z

## Key Decisions Made
- M1 Database Layer complete & verified (82 stress tests pass).
- E2E Test Suite Track complete (213 tests, 100% pass, TEST_READY.md published).
- M2 Backend Core complete & verified (Gate PASS, 36 official + 46 adversarial tests pass).
- Dispatched `sub_orch_m3` (Conv ID: `995f7eee-8b29-450e-b470-323ba9a80d7a`) for Milestone 3.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| sub_orch_m2_r2 | self | Sub-orchestrator: M2 Backend Core | completed | b4442109-5705-4dae-83ed-e0f0f2dcfbf3 |
| sub_orch_m3 | self | Sub-orchestrator: M3 Backend Extended | in-progress | 995f7eee-8b29-450e-b470-323ba9a80d7a |

## Succession Status
- Succession required: no
- Spawn count: 2 / 16
- Pending subagents: 995f7eee-8b29-450e-b470-323ba9a80d7a
- Predecessor: none
- Successor spawned: not yet spawned
- Successor generation: gen2
- Successor state folder: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\orchestrator_gen2

## Active Timers
- Heartbeat cron: 99996677-bcd3-49e3-9e61-907083da4981/task-32
- Safety timer: 99996677-bcd3-49e3-9e61-907083da4981/task-233
- On succession: kill all timers before spawning successor
- On context truncation: handle timers as step 4 of the State Recovery section of your prompt says

## Artifact Index
- PROJECT.md — global architecture, milestones, interfaces, code layout
- TEST_READY.md — E2E test runner, coverage summary (213 tests, 100% pass)
- .agents/teamwork/orchestrator_gen2/BRIEFING.md — persistent working memory
- .agents/teamwork/orchestrator_gen2/progress.md — liveness and state tracking
- .agents/teamwork/orchestrator_gen2/DISPATCH.md — incoming dispatch instructions
- .agents/teamwork/ORIGINAL_REQUEST.md — user request record
