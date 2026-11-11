# Risks: Synthetic filter flow
Ticket: CASE-401
Source: flow-model.md (2026-11-11)
Challenged: 2026-11-11

| ID | Step/State | Risk | Proposed oracle | Observable | Status |
|---|---|---|---|---|---|
| R1 | Save filter | Persisted filter may not survive reload | Saved filter is present after reload | no | PROPOSED |
