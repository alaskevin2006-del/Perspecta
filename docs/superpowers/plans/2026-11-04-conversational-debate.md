# Conversational Debate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the new page's advice rotation with a bounded four-stage character-to-character debate while retaining old API consumers.

**Architecture:** Opt-in rounds:4 preserves response keys and legacy rounds:2 default. One provider call produces a balanced reply chain, checked by backend and frontend. Traceable persona discussion guidance restores omitted ideas without executing source templates.

**Tech Stack:** Existing Node22 ESM, React19/TypeScript/Vite, no new dependencies.

**Spec:** docs/superpowers/specs/2026-11-04-conversational-debate-design.md

## Global Constraints

- Four stages, 2–4 roles,8/12/16 messages; no in-session user contribution.
- New page explicitly requests rounds:4; omitted rounds remains legacy2; same five response keys.
- First replyTo=null, all later replies point to immediately previous different role; balance every phase.
- Keep AI disclosure, source boundaries, fixed cost/timeout/rate protection, no automatic retry or hidden mock fallback.
- Effective new output cap4500 by default; respect existing explicit admin cap. No key in frontend/log/Git, no deploy/main changes.

## Review Focus

- Legacy clients must still get two rounds and consume saved samples.
- Stage boundaries must remain chained without a same-speaker handoff.
- Larger results must reserve their actual output cap and stay bounded before dispatch.
- Persona guidance must remain traceable, preserve core positions and avoid raw source commands.
- Frontend must expose all16 records, pause/skip/export and errors without inventing user participation.

### Task1: Backend protocol and bounded debate generation

Files: backend/src/{discussion,validation,prompt,mock,app,model,config}.js; backend/api-contract.d.ts; backend/data/discussion-guidance.json; backend/test/conversation.test.js.
Interfaces: buildTurnPlan(roleIds,rounds=4); validateOutput(value,roleIds,{rounds=2}={}); input.rounds defaults2; buildMessages usesinput.rounds; model validates same mode.
- [x] Write RED tests for legacy default, valid4, invalid rounds,8/12/16 chain/balance, self/future/non-adjacent reply, meta wording/quotes, varied partners, cap config/reservation and single fake upstream.
- [x] Implement bounded plan, optional mode, guidance projection/prompt, deterministic mock; same effective cap in guard and generate.
- [x] Run targeted then all backend tests; update only assertions that describe intentional v2 behavior. Keep historical tests legacy.

### Task2: New page protocol and four-stage playback

Files: src/data.ts,src/data.test.ts,src/App.tsx,src/style.css,scripts/integration-smoke.mjs.
Interfaces: Message.round=1|2|3|4; validateDebate(value,ids,rounds=4); generateDebate sendsrounds4; legacy validation selectable explicitly.
- [x] Write RED tests for4stage mock/validation, malformed chains and phase titles.
- [x] Implement new page request, four-stage history and labels, statement that user cannot interrupt; retain controls/export.
- [x] Run frontend tests, typecheck/build, actual proxy smoke8/12/16 and legacy raw POST; prove error propagation/no fallback.

### Task3: Browser, one real quality sample and handoff

Files: .doc/{01,02,03,04} relevant addenda; docs/conversational-debate-validation.md; docs/verification; backend/examples; artifacts/conversation-ui-20261104.
- [x] Record before/after persona audit including exact field omissions, bytes and restored source sections.
- [x] Verify actual Chrome mock2/3/4 modes, stage boundaries,16 playback/history/summary, controls/error/disclosure.
- [x] Review code; run synthetic one-attempt harness before live.
- [x] Use new private persistent lock and user-authorized key server-side for one true four-person request; record exact result/usage and manual argument/voice/semantic review. Do not reset old locks.
- [x] Verify real browser playback/summary, save evidence, stop services/reset viewport; document limitations and pending product/persona approval.
- [x] Final review/tests/privacy/hash/remote checks, normal push existing integration branch, verify exact remote SHA. No main merge/deploy.

执行增量：发现队友三轮和main新版指南后暂停第二次预备请求（0次），实际合并并保留显式3；旧省略2、新页4。真实总3次（2拒绝、1通过），均人工确认前次后独立单次，不是自动重试。最终push与清理完成情况以验证报告和交付SHA为准。
