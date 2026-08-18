# Product Design

English | [中文](product.zh.md)

## Problem

Users can see which tools a DSH deployment exposes, but a tool list does not explain the runtime cost, external-state activity, or evidence quality of a plugin identity. A single risk score would hide the difference between a deployment declaration and an observed event.

## Product goal

Runtime Nutrition Label gives operators a compact, machine-readable and human-readable report for each configured plugin or tool namespace. The report answers four questions:

- What does the deployment declare this plugin may do?
- Which tools were visible and how large were their schemas?
- Which calls, files, and network hostnames were observed in this process window?
- Which fields are observed facts, configuration-derived inferences, or declarations?

The distributed package is a DSH bundle. Installing it with `dsh plugin --profile <name> add dsh-runtime-nutrition-label` adds the bundle to that profile and mounts the collector service and human command without a separate patch argument.

## Users

- Harness operators reviewing a profile before enabling a plugin.
- Plugin authors checking whether a tool namespace behaves as documented.
- Security and support engineers investigating unexpected tool or filesystem activity.
- CI and release automation validating a bounded runtime report without retaining secrets.

## Label semantics

Each label has a stable configured id, a display name, a declaration section, an observed section, and bounded evidence records. Tool ownership comes from exact names and prefixes. The plugin does not claim to discover Cordis fiber ownership from generic event payloads.

The product does not produce a scalar grade. Consumers can apply their own policy to explicit fields while preserving the source and limitations of each field.

## Privacy and retention

The default report retains sizes, counts, duration statistics, hostnames, and optional path samples. It does not retain raw arguments, raw results, file contents, credential values, URL paths, URL queries, URL fragments, or tokens. Evidence and representative samples have configurable caps.

## Non-goals

- Replacing the DSH permission or sandbox policy.
- Proving hidden provider behavior that emits no DSH event.
- Persisting a long-term audit archive.
- Ranking plugins with a universal trust or safety score.
- Requiring a web UI for the first release.

## Success criteria

The first release is successful when `dsh plugin` can install and activate the bundle, a deployment can run ordinary tools and inspect one bounded snapshot, and each reported field can be explained without reading raw model or tool payloads. A separate renderer or telemetry exporter can consume the same snapshot without changing collection semantics.
