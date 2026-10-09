# Web profile 1TMT MCP connector

Chinese explanation for Java developers (covers both this repo and RuoYi-Vue): see `RuoYi-Vue/docs/Harness连接MCP改动说明.md` in the sibling checkout. Windows zip-without-pnpm: `RuoYi-Vue/docs/Harness绿色包改动说明.md`.

This web bundle inserts one `@deepseek-ai/dsh-mcp-client` row (`id: mcp-1tmt`, `serverName: 1tmt`, Streamable HTTP). Default URL `http://127.0.0.1:8081/mcp` and `Authorization: Bearer local-mcp-change-me` match `mcp.auth-token`. Override with `DSH_1TMT_MCP_URL` and `DSH_1TMT_MCP_TOKEN`. `failOnStartupError: false` so a missing MCP server does not fail `dsh web` boot. Model-facing names are `mcp__1tmt__<tool>`: `workbuddyPing`, `kduPing` or `kdePing`, `pgyPing`/`pgyEcho`.
