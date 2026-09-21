---
name: antigravity-live-agent
description: >-
  Operates Antigravity as a live software engineering and debugging agent with real browser interaction,
  runtime observation, DOM/accessibility tree inspection, console/network error tracking, physical UI
  manipulation, and live repair loops. Use whenever building, debugging, editing, refactoring, or verifying
  any web application, frontend UI component, or browser runtime workflow.
---

# Antigravity Live Agent — Real Browser Execution & Runtime Debugging Protocol

## 1. Core Principle: Runtime Observation Over Speculation

Antigravity operates as a **LIVE software engineering agent**.
- Source code is a hypothesis; runtime behavior is the truth.
- Passing builds, TypeScript checks, and offline unit tests are necessary baselines, but **NEVER** constitute proof that a UI or web application functions correctly.
- For all web tasks, Antigravity **MUST** run the application, open a real browser via Chrome DevTools MCP (`chrome-devtools`) or Puppeteer MCP (`puppeteer`), visually observe the UI, interact with controls, and verify console/network health.

---

## 2. Tool Architecture: Native Browser Execution

Browser tools in Antigravity are accessible via `call_mcp_tool`:

| Capability | ServerName | ToolName | Arguments / Notes |
| :--- | :--- | :--- | :--- |
| **List Open Pages** | `chrome-devtools` | `list_pages` | `{}` — returns page IDs, URLs, and active tab |
| **Navigate / Reload** | `chrome-devtools` | `navigate_page` | `{"pageId": 1, "type": "url", "url": "http://localhost:..."}` or `{"pageId": 1, "type": "reload"}` |
| **New Page** | `chrome-devtools` | `new_page` | `{"url": "http://localhost:..."}` |
| **Inspect DOM / A11y** | `chrome-devtools` | `take_snapshot` | `{"pageId": 1}` — returns hierarchical a11y tree with element `uid`s |
| **Physical Click** | `chrome-devtools` | `click` | `{"pageId": 1, "uid": "1_3", "includeSnapshot": true}` |
| **Form Input / Typing** | `chrome-devtools` | `fill` or `type_text` | `{"pageId": 1, "uid": "1_5", "value": "test"}` |
| **Console Errors** | `chrome-devtools` | `list_console_messages` | `{"pageId": 1}` — returns uncaught exceptions, errors, warnings |
| **Network Requests** | `chrome-devtools` | `list_network_requests` | `{"pageId": 1}` — returns HTTP status, failed endpoints, 404s, 500s |
| **Visual Screenshot** | `chrome-devtools` | `take_screenshot` | `{"pageId": 1}` — **CRITICAL**: omit `filePath` to avoid sandbox restrictions; Antigravity auto-offloads the screenshot to the artifact brain |
| **Evaluate Script** | `chrome-devtools` | `evaluate_script` | `{"pageId": 1, "function": "() => document.title"}` |
| **Fallback Browser** | `puppeteer` | `puppeteer_navigate`, `puppeteer_click`, `puppeteer_screenshot` | Fallback browser engine |

---

## 3. The 7-Step Live Agent Execution Loop

For any task involving web UI, frontend bugs, new features, or regressions:

```text
1. UNDERSTAND & PLAN
      ↓
2. LAUNCH LOCAL SERVER (IsDaemon: true)
      ↓
3. DISCOVER LISTENING URL (e.g. http://localhost:3000)
      ↓
4. OPEN REAL BROWSER (chrome-devtools navigate_page)
      ↓
5. OBSERVE & INSPECT (take_snapshot, take_screenshot, list_console_messages)
      ↓
6. PHYSICALLY INTERACT (click, fill, open modals, test primary journey)
      ↓
7. DIAGNOSE → REPAIR → RELOAD → RE-VERIFY → GATE CHECK
```

### Step 1: Start Application
- Run the start/dev command using `run_command` with `IsDaemon: true` and `WaitMsBeforeAsync: 3000`.
- Example: `bun run dev`, `bun run preview`, or `node dist/server.mjs`.

### Step 2: Discover Active URL
- Inspect command output or probe common local ports (3000, 5173, 8080) to discover the actual reachable URL.

### Step 3: Open Real Browser & Verify Render
- Call `chrome-devtools` -> `list_pages` to find or create an active page.
- Call `chrome-devtools` -> `navigate_page` to the discovered URL.
- Call `chrome-devtools` -> `take_snapshot` to inspect page structure and element `uid`s.
- Call `chrome-devtools` -> `take_screenshot` (with only `{"pageId": 1}`) to visually observe the rendered viewport.

### Step 4: Physical UI Interaction
- Find the `uid` of target buttons, inputs, links, or navigation tabs from `take_snapshot`.
- Call `chrome-devtools` -> `click` or `fill`.
- Never stop at the homepage: navigate to the relevant screen, open modals, submit forms, and test states.

### Step 5: Runtime State Inspection
- Call `chrome-devtools` -> `list_console_messages` to check for uncaught JavaScript exceptions, React render errors, or hydration failures.
- Call `chrome-devtools` -> `list_network_requests` to check for failed API calls, 404 assets, CORS errors, or 500 responses.

### Step 6: Live Repair Loop
When an issue is detected:
1. **Isolate**: Correlate the console error or UI glitch to the responsible source component.
2. **Patch**: Apply targeted code edits with `replace_file_content`.
3. **Rebuild / Hot-Reload**: Wait for HMR or rebuild if using compiled bundles.
4. **Reload Browser**: Call `chrome-devtools` -> `navigate_page` with `{"pageId": 1, "type": "reload"}`.
5. **Reproduce & Verify**: Perform the exact same user interaction that previously failed. Verify the UI updates correctly and `list_console_messages` shows 0 errors.

### Step 7: Adversarial Review & Regression Check
- Ask: *"What else could be broken?"*
- Test adjacent controls, tabs, and primary workflows.
- Verify persistence (e.g. reload and check local storage or state).

---

## 4. Hard Completion Gate Checklist

Before declaring any web task COMPLETE or VERIFIED, all items must be satisfied:

- [ ] Application started as a background server.
- [ ] Actual running URL discovered and verified.
- [ ] Real browser opened via `chrome-devtools` or `puppeteer`.
- [ ] Initial render visually confirmed (no blank screen, no overlapping elements).
- [ ] Accessibility tree / DOM inspected (`take_snapshot`).
- [ ] Primary user journey physically executed (buttons clicked, forms tested).
- [ ] Console checked (`list_console_messages`) — 0 unhandled errors.
- [ ] Network checked (`list_network_requests`) — no unexpected 4xx/5xx requests.
- [ ] If a fix was made, application reloaded and user interaction re-tested.
- [ ] Visual screenshot recorded as evidence.
- [ ] Regression check performed across related screens.

---

## 5. Prohibited Behaviors

1. **NO Phantom Browser Claims**: Never state "browser verified" unless `call_mcp_tool` was actually executed.
2. **NO Unit-Test-Only Signoff**: A green `vitest` or `bun test` does NOT replace live browser execution.
3. **NO User Testing Offloading**: Never tell the user "Please open http://localhost:3000 to verify". The agent MUST open it and verify it autonomously.
4. **NO Blind File Reading**: Do not guess runtime errors from source code when you can observe the actual console exception in DevTools.
