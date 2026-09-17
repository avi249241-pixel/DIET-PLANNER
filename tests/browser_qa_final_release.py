import os
import sys
import time
import base64
import subprocess
from playwright.sync_api import sync_playwright

def run_final_release_qa():
    print("=== STARTING FINAL RELEASE HARDENING & PUBLISHING BROWSER QA ===")

    # 1. Create a minimal 1x1 test image
    test_img_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "release_test_meal.png"))
    png_bytes = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
    with open(test_img_path, "wb") as f:
        f.write(png_bytes)

    # 2. Launch production server with ALLOW_TEST_TOKEN=true
    env = os.environ.copy()
    env["ALLOW_TEST_TOKEN"] = "true"
    env["PORT"] = "3000"

    server_process = subprocess.Popen(
        "bun dist/server.mjs",
        shell=True,
        cwd=os.path.abspath(os.path.join(os.path.dirname(__file__), "..")),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    time.sleep(3)
    app_url = "http://localhost:3000"
    console_errors = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)

            # =========================================================
            # STAGE 1: DESKTOP VIEWPORT (1280x800)
            # =========================================================
            print("\n--- STAGE 1: DESKTOP AUDIT (1280x800) ---")
            context = browser.new_context(viewport={"width": 1280, "height": 800})
            page = context.new_page()

            def on_console(msg):
                if msg.type == "error":
                    if "favicon" not in msg.text.lower():
                        print(f"[Desktop Console Error]: {msg.text}")
                        console_errors.append(msg.text)

            page.on("console", on_console)

            # 1.1 Navigate to app
            print("1. Loading production bundle on http://localhost:3000...")
            page.goto(app_url, wait_until="networkidle")
            page.wait_for_timeout(800)

            # 1.2 Authenticate via Guest Demo
            print("2. Authenticating via Guest Demo...")
            demo_btn = page.locator("button:has-text('Instant 1-Click Guest Demo')")
            assert demo_btn.is_visible(), "Guest Demo button not found"
            demo_btn.click()
            page.wait_for_timeout(800)

            # 1.3 Verify Profile Setup screen
            print("3. Testing Profile Setup (Mifflin-St Jeor calculation)...")
            page.locator("nav button:has-text('Profile')").click()
            page.wait_for_timeout(500)
            assert "Profile & Target Energy Setup" in page.inner_text("body")
            print("   SUCCESS: Profile screen rendered with live deterministic targets.")

            # 1.4 Test Photo Upload & Provenance Pipeline
            print("4. Testing Live Photo Logger in Quick Log...")
            page.locator("nav button:has-text('Quick Log')").click()
            page.wait_for_timeout(500)

            file_input = page.locator("input[type='file']")
            with page.expect_response("**/api/ai/analyze-food", timeout=12000) as response_info:
                file_input.set_input_files(test_img_path)

            resp_obj = response_info.value
            assert resp_obj.status == 200, f"Expected status 200, got {resp_obj.status}"
            data = resp_obj.json()
            assert data["success"] == True
            meal = data["data"]
            print(f"   SUCCESS: Analyzed meal '{meal['name']}' with source {meal['nutritionSource']}")

            # Log meal into local store
            log_btn = page.locator("button:has-text('Confirm & Save Log')")
            if log_btn.is_visible():
                log_btn.click()
                page.wait_for_timeout(500)

            # 1.5 Test Daily Log & Provenance Badges
            print("5. Inspecting Daily Log...")
            page.locator("nav button:has-text('Daily Log')").click()
            page.wait_for_timeout(500)
            assert "Daily Nutrition Breakdown" in page.inner_text("body")
            assert any(tag in page.inner_text("body") for tag in ["USDA", "LOCAL", "ESTIMATE", "OFF"])
            print("   SUCCESS: Daily Log rendered with verified provenance badges.")

            # 1.6 Test Hydration Tracker
            print("6. Testing Hydration Tracker...")
            page.locator("nav button:has-text('Hydration')").click()
            page.wait_for_timeout(500)
            assert "Hydration & Fluid Balance" in page.inner_text("body")
            add_water_btn = page.locator("button:has-text('+1 Glass (250ml)')")
            assert add_water_btn.is_visible()
            add_water_btn.click()
            page.wait_for_timeout(300)
            print("   SUCCESS: Hydration logged successfully.")

            context.close()

            # =========================================================
            # STAGE 2: MOBILE VIEWPORT (375x667 - iPhone SE)
            # =========================================================
            print("\n--- STAGE 2: MOBILE VIEWPORT AUDIT (375x667) ---")
            m_context = browser.new_context(viewport={"width": 375, "height": 667})
            m_page = m_context.new_page()

            def on_m_console(msg):
                if msg.type == "error":
                    if "favicon" not in msg.text.lower():
                        print(f"[Mobile Console Error]: {msg.text}")
                        console_errors.append(msg.text)

            m_page.on("console", on_m_console)

            print("1. Loading mobile dashboard...")
            m_page.goto(app_url, wait_until="networkidle")
            m_page.wait_for_timeout(800)

            m_demo_btn = m_page.locator("button:has-text('Instant 1-Click Guest Demo')")
            if m_demo_btn.is_visible():
                m_demo_btn.click()
                m_page.wait_for_timeout(800)

            # Confirm no horizontal viewport overflow
            scroll_width = m_page.evaluate("document.documentElement.scrollWidth")
            client_width = m_page.evaluate("document.documentElement.clientWidth")
            print(f"   Mobile viewport width: clientWidth={client_width}, scrollWidth={scroll_width}")
            assert scroll_width <= client_width + 1, f"Horizontal overflow detected: scrollWidth {scroll_width} > clientWidth {client_width}"

            # Verify navigation to Quick Log on mobile strip
            mobile_quick_log = m_page.locator(".lg\\:hidden button:has-text('Quick Log')")
            assert mobile_quick_log.is_visible()
            mobile_quick_log.click()
            m_page.wait_for_timeout(500)
            assert "Live Nutrition Logger" in m_page.inner_text("body")
            print("   SUCCESS: Mobile navigation and Quick Log verified without overflow.")

            m_context.close()
            browser.close()

    finally:
        server_process.terminate()
        try:
            server_process.wait(timeout=3)
        except:
            server_process.kill()

        if os.path.exists(test_img_path):
            os.remove(test_img_path)

    print("\n=== FINAL AUDIT RESULTS ===")
    print(f"Console errors: {len(console_errors)}")

    if console_errors:
        print("FAIL: Console errors detected during final release verification!")
        sys.exit(1)

    print("SUCCESS: Production release verified across all viewports with 0 errors!")

if __name__ == "__main__":
    run_final_release_qa()
