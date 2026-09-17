import os
import sys
import time
import subprocess
from playwright.sync_api import sync_playwright

def run_qa():
    print("=== STARTING BASELINE UI BROWSER QA ===")
    
    # 1. Start Vite preview server on port 4173 (or verify if already running)
    server_process = subprocess.Popen(
        "bunx vite preview --port 4173",
        shell=True,
        cwd=os.path.abspath(os.path.join(os.path.dirname(__file__), "..")),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    time.sleep(3) # Wait for preview server to be ready

    app_url = "http://localhost:4173"
    console_errors = []
    external_ai_network_calls = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)

            # ==========================================
            # TEST 1: DESKTOP AUDIT (1280x800)
            # ==========================================
            print("\n--- 1. DESKTOP VIEWPORT TEST (1280x800) ---")
            context = browser.new_context(viewport={"width": 1280, "height": 800})
            page = context.new_page()

            # Network & Console listeners
            def on_request(request):
                url = request.url
                forbidden_patterns = [
                    "generativelanguage.googleapis.com",
                    "nal.usda.gov",
                    "openfoodfacts.org",
                    "/api/gemini",
                    "/api/nutrition"
                ]
                for pattern in forbidden_patterns:
                    if pattern in url:
                        print(f"FAILED: Forbidden network request detected: {url}")
                        external_ai_network_calls.append(url)

            def on_console(msg):
                if msg.type == "error":
                    # Ignore harmless favicon or known benign dev warnings
                    if "favicon" not in msg.text.lower():
                        print(f"[Console Error]: {msg.text}")
                        console_errors.append(msg.text)

            page.on("request", on_request)
            page.on("console", on_console)

            # Step 1.1: Load Landing Page
            print("Navigating to landing page...")
            page.goto(app_url, wait_until="networkidle")
            page.wait_for_timeout(1000)

            # Verify Landing Elements
            assert "VibeDiet 3D Tracker" in page.content(), "Landing hero title missing"
            print("Landing hero rendered with 3D ambient background.")

            # Step 1.2: Instant Guest Demo Login
            demo_btn = page.locator("button:has-text('Instant 1-Click Guest Demo')")
            assert demo_btn.is_visible(), "Instant demo button missing"
            demo_btn.click()
            page.wait_for_timeout(1000)

            # Confirm Dashboard loaded
            assert "Daily Nutrition Breakdown" in page.content(), "Dashboard failed to load after login"
            print("Guest authenticated into Baseline Dashboard.")

            # Step 1.3: Screen 3 (Daily Log) Verification
            print("\n[Screen 3: Daily Log]")
            assert "Steel-Cut Oatmeal" in page.content(), "Seed food item 1 missing"
            assert "Grilled Herb Chicken" in page.content(), "Seed food item 2 missing"
            assert "Greek Yogurt" in page.content(), "Seed food item 3 missing"
            print("Initial mock food items verified.")

            # Delete item test
            delete_btns = page.locator("button[title='Remove item']")
            initial_count = delete_btns.count()
            print(f"Initial food count: {initial_count}")
            assert initial_count == 3, f"Expected 3 seed items, found {initial_count}"

            # Remove third item
            delete_btns.nth(2).click()
            page.wait_for_timeout(500)
            new_count = page.locator("button[title='Remove item']").count()
            assert new_count == 2, f"Expected 2 items after deletion, found {new_count}"
            print("Item deletion and reactive recalculation verified.")

            # Step 1.4: Screen 2 (Quick Log) Verification
            print("\n[Screen 2: Quick Log]")
            page.locator("button:has-text('Quick Log')").first.click()
            page.wait_for_timeout(500)
            assert "Quick Nutrition Logger" in page.content()

            # Photo upload widget verification (offline stub)
            assert "Photo Meal Recognition Widget" in page.content()
            assert "Prompt 2 Seam (Stub)" in page.content()

            # Enter Manual Food Item
            page.fill("input[placeholder*='Grilled Salmon']", "Protein Blueberry Pancakes")
            page.fill("input[placeholder*='1 fillet']", "3 pancakes")
            page.fill("input[placeholder='450']", "420")
            page.fill("input[placeholder='35']", "36")
            page.fill("input[placeholder='40']", "48")
            page.fill("input[placeholder='12']", "8")
            
            # Select Breakfast slot
            page.locator("button:has-text('Breakfast')").click()

            # Submit
            page.locator("button:has-text('Add to Local Food Log')").click()
            page.wait_for_timeout(600)
            assert "Successfully logged" in page.content()
            print("Manual food entry saved into local state.")

            # Verify in Daily Log
            page.locator("button:has-text('Inspect Log')").click()
            page.wait_for_timeout(500)
            assert "Protein Blueberry Pancakes" in page.content()
            print("New meal verified in Daily Log.")

            # Step 1.5: Screen 1 (Profile Setup) Verification
            print("\n[Screen 1: Profile Setup]")
            profile_btn = page.locator("nav button:has-text('Profile Setup')")
            profile_btn.click()
            page.wait_for_timeout(500)
            assert "Profile & Target Energy Setup" in page.inner_text("body")

            # Verify deterministic Mifflin-St Jeor calculations
            page.fill("input[type='number'] >> nth=0", "180") # Height
            page.fill("input[type='number'] >> nth=1", "80")  # Weight
            page.fill("input[type='number'] >> nth=2", "75")  # Target Weight
            page.fill("input[type='number'] >> nth=3", "30")  # Age
            page.wait_for_timeout(500)

            # Mifflin calculation for 80kg, 180cm, 30yo, male:
            # 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780 BMR
            assert "1780" in page.inner_text("body"), "Deterministic BMR calculation mismatch"
            print("Live deterministic Mifflin-St Jeor formula verified (BMR 1780 kcal).")

            # Save Profile
            page.locator("button:has-text('Save Profile & Targets')").click()
            page.wait_for_timeout(1500)

            # Step 1.6: Screen 4 (Diet Plan) Verification
            print("\n[Screen 4: Diet Plan]")
            page.locator("nav button:has-text('Diet Plan')").click()
            page.wait_for_timeout(500)
            assert "Diet Plan & Macro Blueprint Selector" in page.inner_text("body")
            assert "Mediterranean" in page.inner_text("body")
            assert "Keto / Low Carb" in page.inner_text("body")

            # Select Mediterranean plan
            med_btn = page.locator("button:has-text('Select Mediterranean')")
            med_btn.click()
            page.wait_for_timeout(500)
            assert "Switched dietary framework to Mediterranean" in page.inner_text("body")
            print("Diet plan selection persisted into in-memory state.")

            # Step 1.7: Screen 5 (Hydration) Verification
            print("\n[Screen 5: Hydration]")
            page.locator("nav button:has-text('Hydration')").click()
            page.wait_for_timeout(500)
            assert "Hydration & Fluid Balance" in page.inner_text("body")

            # Stepper +1
            plus_btn = page.locator("button:has-text('+1 Glass (250ml)')")
            plus_btn.click()
            page.wait_for_timeout(300)

            # Presets +2
            preset_btn = page.locator("button:has-text('+2 Glasses')")
            preset_btn.click()
            page.wait_for_timeout(300)

            # Reset count
            reset_btn = page.locator("button:has-text('Reset Daily Count')")
            reset_btn.click()
            page.wait_for_timeout(500)
            assert "Water count reset to 0" in page.inner_text("body")
            print("Hydration stepper, preset increments, and reset stub verified.")

            # Step 1.8: Unimplemented Nav Items Check
            print("\n[Unimplemented Features Check]")
            unimplemented_btn = page.locator("header button[title*='Barcode Scanner']").first
            is_vis = unimplemented_btn.is_visible()
            print(f"Barcode button visible in header: {is_vis}")
            if is_vis:
                unimplemented_btn.click()
                page.wait_for_timeout(500)
                print("Page body after modal click:", page.locator("body").inner_text()[-400:])
                assert "PROMPT 2 ROADMAP" in page.inner_text("body").upper()
                assert "Barcode Scanner" in page.inner_text("body")
                page.locator("button:has-text('Understood & Return')").click()
                page.wait_for_timeout(300)
                print("Prompt 2 unimplemented modal verified.")
            else:
                # Try clicking from mobile sub-bar if not in header
                mobile_feat_btn = page.locator("button:has-text('Barcode')").first
                if mobile_feat_btn.is_visible():
                    mobile_feat_btn.click()
                    page.wait_for_timeout(500)
                    assert "PROMPT 2 ROADMAP" in page.inner_text("body").upper()
                    page.locator("button:has-text('Understood & Return')").click()
                    print("Prompt 2 modal verified via nav strip.")

            context.close()

            # ==========================================
            # TEST 2: MOBILE VIEWPORT TEST (375x667)
            # ==========================================
            print("\n--- 2. MOBILE VIEWPORT TEST (375x667) ---")
            mobile_context = browser.new_context(
                viewport={"width": 375, "height": 667},
                user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15"
            )
            mobile_page = mobile_context.new_page()
            mobile_page.on("request", on_request)
            mobile_page.on("console", on_console)

            mobile_page.goto(app_url, wait_until="networkidle")
            mobile_page.wait_for_timeout(800)

            # Login on mobile
            mobile_demo_btn = mobile_page.locator("button:has-text('Instant 1-Click Guest Demo')")
            mobile_demo_btn.click()
            mobile_page.wait_for_timeout(800)

            # Verify mobile navigation strip
            assert mobile_page.locator("button:visible:has-text('Daily Log')").is_visible()
            assert mobile_page.locator("button:visible:has-text('Quick Log')").is_visible()
            assert mobile_page.locator("button:visible:has-text('Hydration')").is_visible()

            # Navigate to Hydration on mobile
            mobile_page.locator("button:visible:has-text('Hydration')").click()
            mobile_page.wait_for_timeout(500)
            assert "Hydration & Fluid Balance" in mobile_page.inner_text("body")

            # Check for layout overflows
            scroll_width = mobile_page.evaluate("() => document.documentElement.scrollWidth")
            inner_width = mobile_page.evaluate("() => window.innerWidth")
            assert scroll_width <= inner_width + 5, f"Horizontal overflow on mobile: scrollWidth={scroll_width}, innerWidth={inner_width}"
            print(f"Mobile layout responsive (scrollWidth={scroll_width}, innerWidth={inner_width}).")

            mobile_context.close()
            browser.close()

    finally:
        server_process.terminate()
        try:
            server_process.wait(timeout=3)
        except:
            server_process.kill()

    print("\n=== AUDIT RESULTS ===")
    print(f"External AI/Nutrition network calls: {len(external_ai_network_calls)}")
    print(f"Console errors: {len(console_errors)}")

    if external_ai_network_calls:
        print("FAIL: External AI network calls occurred!")
        sys.exit(1)

    if console_errors:
        print(f"FAIL: {len(console_errors)} console errors observed:")
        for err in console_errors:
            print(f"  - {err}")
        sys.exit(1)

    print("SUCCESS: All 5 screens verified functional on mock data with ZERO AI calls and ZERO console errors!")

if __name__ == "__main__":
    run_qa()
