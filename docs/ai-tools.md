# How I used AI tools

Back to the [README](../README.md). Agent rules: [AGENTS.md](../AGENTS.md).

- Claude Code for scaffolding and most of the typing; I owned scope, architecture, review and every commit.
- Before coding: decisions settled in a Q&A round, then two independent critique passes (a sceptic and a reviewer) that cut the scope from ~18 h to ~10 h and changed the app from three services to one.
- Rules for the agent live in `AGENTS.md` (commands, AI SDK v7 pitfalls, test-first for `lib/rag`).
- Checks on generated code: typecheck/lint/tests on every commit, real-API probes before relying on a library (Voyage rerank-3 through the community provider), reading the real label text before writing the parser, the eval set before trusting retrieval.
- Things the AI got wrong and how they were caught:
  - The first prompt applied the label's dose-reduction criteria to a user's mother. Caught by a manual test, fixed in the prompt, now an eval case.
  - The first quote check compared letters and digits only, so "25 mg" matched "2.5 mg" and ">30" matched "<30". Caught by a second agent asked to break the change, before it shipped; there is a unit test for it now.
  - Two citations on the same PDF page kept the first one's highlight. Caught in a code review pass, fixed by deriving the highlight from the passage.
  - Building the Docker image failed because env validation ran at build time. Caught by a clean-clone build.
- Do's and don'ts:
  - Do: settle decisions and the eval set before code; ask a second agent to break each change; read every diff; check the UI at phone width myself.
  - Don't: trust "tests pass" for UI or retrieval quality; accept a library claim without a live probe; let the agent pick dependencies.
