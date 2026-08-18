# ADR 0001: Publish Evidence, Not a Scalar Score

English | [中文](0001-evidence-not-score.zh.md)

## Context

Runtime labels combine deployment declarations, event observations, and configuration-derived classifications. These sources have different authority and may disagree without indicating an instrumentation failure.

## Decision

The plugin publishes separate `declared`, `observed`, and `inferred` fields with bounded evidence records. It does not publish a scalar safety, trust, or risk score.

## Alternatives considered

- A single score was rejected because it would hide whether a value came from configuration or runtime evidence.
- A hidden provider-inspection API was rejected because generic DSH events do not establish a stable Cordis plugin-owner identity.
- Raw payload retention was rejected because the report must be safe to export during debugging.

## Consequences

Consumers must define their own policy over explicit fields. Reports are less convenient to rank, but operators can explain each value and preserve the evidence source. Future scoring can be implemented as a separate consumer without changing collection or privacy semantics.

## Verification

Tests assert source-separated evidence, bounded records, immutable snapshots, explicit attribution, and the absence of raw argument, result, URL, and file-content values.
