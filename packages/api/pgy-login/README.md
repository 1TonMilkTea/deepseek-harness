---
description: "Host WMS login Remote: organizations and employee login through MCP tools."
kind: "package-reference"
---

# @deepseek-ai/dsh-api-pgy-login

English | [中文](README.zh.md)

## Summary

Host Remote namespace `pgyLogin` for RuoYi backend URL configuration, organization listing, and WMS employee login via MCP tools. The Web overlay consumes this Remote through a typed bridge; Session create and prompt stay gated until login succeeds.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Mount the Host plugin in the web-app composition and the matching Client remotes entry. Configure the RuoYi base URL from the login UI or environment before `listOrganizations` / `wmsLogin`.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package gates Host identity and MCP readiness; it does not contribute prompts, tools, or Session events to model requests.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Employee switch requires Host restart** — a different staff identity in the same process is rejected until the Host exits.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
