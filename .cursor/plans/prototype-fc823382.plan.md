<!-- fc823382-d773-4968-b8f2-74564ac90bdf 2bc41759-fb4c-4b61-bacb-6e10ecdb01f0 -->
# P1 (No-DB): Real Tools + Workers + Instant Streaming

## Goals (P1)

- Real web search (Tavily) and web scrape (Firecrawl) with Redis caching and tight timeouts
- Daytona sandbox tools for shell, file ops, and code execution
- Parallel tool execution with retries, circuit breaker, and streaming progress over WebSocket
- Use Redis for cache + live job events. Supabase persistence is P2

## Scope

- Providers: Tavily (search), Firecrawl (scrape), Daytona (exec/fs). No DB writes
- Tools implemented: `web_search`, `web_scrape`, `shell`, `file`, `code`, `computer`
- API: sync path for fast tools; async jobs (Dramatiq) for longer tasks with WS streaming

## Backend changes

- Add provider clients
- `backend/services/tavily_client.py`: search (basic/deep), optional extract, 1.5s timeout
- `backend/services/firecrawl_client.py`: scrape single URL, sanitize HTML→text, 2s timeout
- `backend/services/daytona_client.py`: exec, fs read/write/list, working-dir isolation, timeouts
- Replace simulated tools in `backend/tools/__init__.py`
- `web_search` → Tavily (top_k, freshness, site_filters, extract_top_n)
- `web_scrape` → Firecrawl (url, extract_text)
- `shell` → Daytona exec (command, timeout), allow/deny list
- `file` → Daytona fs (read/write/list)
- `code` → Daytona exec (language=python by default)
- `computer` → simple local info (keep)
- Caching & robustness
- Redis cache via `tool_executor` with key: `tool:{name}:{hash(params)}`; TTL 300–600s
- Provider-level timeouts; circuit breaker on consecutive failures; retries for idempotent tools
- Jobs & streaming (no DB)
- Add Dramatiq actor `run_tool_job` (fan-out parallel tools allowed)
- Emit Redis pubsub events: `job:{id}` → progress, partial results, final result
- WebSocket handler subscribes to `job:{id}` and streams events to frontend
- API endpoints
- `/tools/execute` (sync by default; `mode=async` returns `job_id`)
- `/jobs/{id}/events` (SSE fallback) – optional, WS is primary
- `/tools/schemas` reflects new real parameters (no `default` fields for Gemini)

## Frontend (minimal)

- Chat keeps as-is. Computer View terminal subscribes to WS job events and renders:
- `progress`, `tool_result`, `stdout/stderr`, `complete/error`
- Add a “Run as job” toggle (fast tools use sync path; long tasks async)
- Optional: Simple file explorer bound to Daytona (`list/read/write`)

## Config & security

- Env vars: `TAVILY_API_KEY`, `FIRECRAWL_API_KEY`, `DAYTONA_API_KEY`
- Timeouts/TTLs: `WEB_SEARCH_TIMEOUT_MS=1500`, `SCRAPE_TIMEOUT_MS=2000`, `TOOL_CACHE_TTL=600`
- Shell safety: allowlist patterns, max runtime, max output size; redact secrets from logs

## Success criteria

- Search (uncached): ≤300ms; cached: ≤50ms
- Scrape (uncached): ≤700ms; cached: ≤80ms
- Shell (echo/ls): ≤200ms; file ops: ≤100ms
- Parallel 3-tool call: ≤1s total; streaming within 100ms of start

## Rollout (no DB)

1) Tavily + Firecrawl with Redis caching + WS streaming
2) Daytona shell/file/code + WS job events
3) Stabilize/circuit breakers, error surfacing, quotas

P2 will add Supabase tables/storage and persist threads/messages/jobs/artifacts

### To-dos

- [ ] Implement /chat instant + ack logic
- [ ] Add WebSocket /ws/chat/{thread_id} streaming
- [ ] Add SSE /chat/stream endpoint
- [ ] Add /tools/schemas and /tools/execute sync/async
- [ ] Add /jobs/{id}/status and /jobs/{id}/events SSE
- [ ] Align worker to REDIS_URL and implement execute_tool_task
- [ ] Create gemini_client.py with streaming tool-calls
- [ ] Create tool_executor.py with parallel, retry, cache
- [ ] Create redis_client.py helper
- [ ] Wire WS chat, SSE fallback, job events to UI
- [ ] Add structured JSON logs and counters