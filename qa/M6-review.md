# M6 QA review — ready to close with accepted NFR-10 gap

1. **Ledger integrity:** prior case order and every prior attempt were checked byte-for-byte as JSON values. Stock ledger checker falsely reports removed history for repeated exploratory “—” IDs; its history lookup takes the first matching placeholder. A temporary copy keyed by row+TC passed every check; installed skill and repository history were not altered.
2. **Coverage:** TC-255–TC-271 and TC-276–TC-283 have ledger evidence. TC-272–TC-275 belong to T-44 and were not started. NFR-10 is explicitly partial, not silently verified.
3. **Automation:** Docker/guard/k6 adapter/verifier/report/lobby/workflow tests cover M6. SQL parity and concurrency cover the approved bid-path changes. Real CI artifacts cover load-only outcomes.
4. **Retesting:** resolved cases end in real passing attempts; TC-263 remains open despite accepted publication. TC-280's former publication gate is superseded explicitly by D-92; runtime diagnostic isolation passed.
5. **Escalations:** owner decisions D-81–D-92 and PROGRESS replace external ticketing per repository rules. No pending owner decision blocks this authorized closure.
6. **Manual work:** owner's T-42 review is recorded; no new UI code or copy change in publication.
7. **Audit trail:** TC-277 pool4 and TC-279 single-call requirements remain n/a with their superseding decisions and attempts retained.
8. **Repeated failures:** latency experiments are preserved as failed measurements, not retried silently or relabeled passing. Original timing issue resolved; p95 remains the accepted gap.
9. **Agent improvement:** fix the external ledger checker's exploratory-ID history key; format final documentation after ledger updates; keep benchmark threshold failure distinct from owner acceptance. These are tool/process notes, not additional product work.

Verdict: M6/T-43 may close under explicit D-92 acceptance. NFR-10 remains open for later revisit. Thresholds, SQL locks, invariant checks and published numbers are unchanged. No further tuning or dispatches; T-44 stays todo.
