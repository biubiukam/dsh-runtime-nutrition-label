# Security Policy

English | [中文](SECURITY.zh.md)

## Reporting a vulnerability

Please do not open a public issue for a suspected security vulnerability. Use GitHub Private Vulnerability Reporting for the repository, or contact the maintainers through the security contact published by the repository owner.

Include the affected version, a minimal reproduction, impact, and whether the report contains a credential or private data. Redact all secrets before sending the report.

## Security boundaries

The plugin is observational. It does not execute tools, read file contents, resolve credential values, or persist raw model and tool payloads. A deployment remains responsible for configuring tool attribution, filesystem providers, network policy, and the retention destination for exported snapshots.

## Disclosure

Maintainers will coordinate a fix, release, and advisory with the reporter. Do not publish exploit details until a coordinated disclosure date has been agreed.
