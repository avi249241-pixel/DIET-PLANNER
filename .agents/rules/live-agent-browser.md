# Live Agent Browser Execution & Runtime Verification Rule

## Mandatory Policy for Web Applications & UI Tasks

For any task involving web applications, frontend components, user interfaces, or browser runtime flows:

1. **Mandatory Live Browser Verification**:
   - The agent MUST start the application server locally (`run_command` with `IsDaemon: true`).
   - The agent MUST open the live running URL in a real browser using Chrome DevTools MCP (`chrome-devtools` via `call_mcp_tool`).
   - The agent MUST observe the page structure using `take_snapshot` and view visual output via `take_screenshot`.
   - The agent MUST physically interact with relevant controls (buttons, inputs, navigation, modals) using `click` and `fill`.
   - The agent MUST inspect runtime console logs (`list_console_messages`) and network traffic (`list_network_requests`).

2. **No Premature Declarations of Success**:
   - Passing `bunx tsc --noEmit`, `bun run build`, or automated unit tests is necessary but INSUFFICIENT.
   - The agent cannot declare any web UI task DONE, COMPLETE, or VERIFIED without executing the live browser verification protocol.

3. **Autonomous Live Debugging Loop**:
   - If a bug or runtime exception occurs:
     1. Reproduce the failure by clicking or triggering the interaction in Chrome.
     2. Inspect the exact runtime stack trace using `list_console_messages`.
     3. Patch the code using `replace_file_content`.
     4. Reload the page using `navigate_page` (`type: "reload"`).
     5. Re-execute the failed interaction in Chrome.
     6. Confirm the error is gone and the UI updates correctly.
     7. Perform a regression check on adjacent controls.

4. **Zero User Offloading**:
   - Never instruct the user to open a localhost URL or verify a UI fix manually. Antigravity executes all browser verification autonomously.
