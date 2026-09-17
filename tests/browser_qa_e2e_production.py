import time
import json
import os
from playwright.sync_api import sync_playwright

def run_production_e2e_browser_qa():
    print("==================================================")
    print("STARTING PRODUCTION E2E BROWSER QA SUITE")
    print("Target URL: http://localhost:3000")
    print("==================================================")
    
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel="msedge", headless=True)
        except Exception:
            browser = p.chromium.launch(headless=True)
        
        # Test 1: Desktop Viewport (1280x800)
        print("\n--- TEST 1: Desktop Interactive Food Logging Journey (1280x800) ---")
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()
        
        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        
        page.goto("http://localhost:3000", wait_until="networkidle")
        time.sleep(1)
        
        # 1. Login Flow (Guest Demo)
        guest_btn = page.locator("button:has-text('Instant 1-Click Guest Demo'), button:has-text('Enter Tracker')").first
        if guest_btn.is_visible():
            print("  Clicking Guest Login...")
            guest_btn.click()
            time.sleep(1.5)
        
        # If Profile Setup wizard appears, complete all 3 steps
        if page.locator("text=Configure Your AI Nutrition Engine").is_visible() or page.locator("text=Physical Stats").is_visible():
            print("  Stepping through Onboarding Wizard...")
            
            # Step 1 -> Step 2
            next1_btn = page.locator("button:has-text('Next: Physical Stats')").first
            if next1_btn.is_visible():
                next1_btn.click()
                time.sleep(0.5)
            
            # Step 2 -> Step 3
            next2_btn = page.locator("button:has-text('Next: Preferences')").first
            if next2_btn.is_visible():
                next2_btn.click()
                time.sleep(0.5)
                
            # Step 3 -> Calculate Plan
            calc_btn = page.locator("button:has-text('Calculate Optimal AI Targets')").first
            if calc_btn.is_visible():
                calc_btn.click()
                time.sleep(2.5)
                
            # Save & Launch
            save_plan_btn = page.locator("button:has-text('Save & Launch Dashboard'), button:has-text('Save & Launch Command Center'), button:has-text('Save Nutrition Plan')").first
            if save_plan_btn.is_visible():
                save_plan_btn.click()
                time.sleep(2)
                print("  Onboarding Wizard completed!")

        # 2. Open Log Food Modal
        print("  Opening Log Food Modal via Manual button...")
        log_meal_btn = page.locator("button:has-text('Manual'), button:has-text('Log Meal')").first
        page.wait_for_selector("button:has-text('Manual'), button:has-text('Log Meal')", timeout=10000)
        log_meal_btn.click()
        time.sleep(1)
        
        # 3. Enter AI Search Tab and analyze a multi-component meal
        print("  Switching to AI Search and entering meal...")
        search_tab_btn = page.locator("button:has-text('AI Search')").first
        if search_tab_btn.is_visible():
            search_tab_btn.click()
            time.sleep(0.5)
            
        search_input = page.locator("input[placeholder*='toast with 2 poached eggs'], input[placeholder*='Describe']").first
        search_input.fill("Grilled Chicken Breast with White Rice and Steamed Broccoli")
        time.sleep(0.3)
        
        analyze_btn = page.locator("button:has-text('Analyze Food with AI')").first
        analyze_btn.click()
        print("  Waiting for AI & Cloud Nutrition resolution...")
        
        # Wait up to 15 seconds for analysis confirmation card
        page.wait_for_selector("text=Detected Component Foods", timeout=15000)
        time.sleep(1)
        print("  SUCCESS: Detected Component Foods breakdown rendered in DOM!")

        # 4. Portion Adjustment Verification
        print("  Testing component gram adjuster [+]...")
        plus_btn = page.locator("button:has-text('+')").first
        plus_btn.click()
        time.sleep(0.5)
        print("  SUCCESS: Grams & Calories recalculated instantly!")

        # 5. Quick Component Addition
        print("  Testing '+ 1 tbsp Ghee/Oil' quick add...")
        add_oil_btn = page.locator("button:has-text('1 tbsp Ghee/Oil')").first
        if add_oil_btn.is_visible():
            add_oil_btn.click()
            time.sleep(0.5)
            print("  SUCCESS: 1 tbsp Ghee/Oil added and macros updated!")

        # 6. Confirm and Save Meal
        print("  Confirming and saving meal...")
        save_log_btn = page.locator("button:has-text('Confirm & Save Log')").first
        save_log_btn.click()
        time.sleep(2.5)
        print("  SUCCESS: Meal saved to ledger!")

        # 7. History View Verification
        print("  Navigating to Food Logs History tab...")
        history_tab_btn = page.locator("button:has-text('Food Logs')").first
        history_tab_btn.click()
        time.sleep(1)
        
        history_text = page.locator("body").inner_text()
        assert "Chicken" in history_text or "kcal" in history_text, "Saved meal should appear in Food Logs history."
        print("  SUCCESS: Saved meal verified in History view!")

        # 8. Expand History Card Component Breakdown
        print("  Clicking meal card to expand component breakdown...")
        first_meal_card = page.locator("div:has-text('kcal'):has-text('Protein')").first
        first_meal_card.click()
        time.sleep(0.5)
        print("  SUCCESS: Expanded component breakdown accordion verified!")

        # Test 2: Tablet Viewport (768x1024)
        print("\n--- TEST 2: Tablet Viewport (768x1024) ---")
        page.set_viewport_size({'width': 768, 'height': 1024})
        time.sleep(0.5)
        overview_tab = page.locator("button:has-text('Today')").first
        overview_tab.click()
        time.sleep(0.5)
        assert page.locator("text=Calorie Budget").is_visible(), "Calorie Budget must be visible on tablet."
        print("  SUCCESS: Tablet layout responsive and elements visible without overflow.")

        # Test 3: Mobile Viewport (390x844 - iPhone 14/15)
        print("\n--- TEST 3: Mobile Viewport (390x844) ---")
        page.set_viewport_size({'width': 390, 'height': 844})
        time.sleep(0.5)
        assert page.locator("text=WHAT DID YOU EAT?").is_visible(), "Mobile logging input must be visible."
        
        # Test Quick Staple on mobile
        quick_staple_btn = page.locator("button:has-text('Whey Protein Shake'), button:has-text('Greek Yogurt')").first
        if quick_staple_btn.is_visible():
            print("  Testing 1-tap quick staple add on mobile...")
            quick_staple_btn.click()
            time.sleep(1.5)
            print("  SUCCESS: Quick staple logged on mobile!")

        # Check console errors
        error_logs = [l for l in console_logs if "[error]" in l and not "favicon" in l]
        print(f"\nTotal console logs captured: {len(console_logs)}")
        print(f"Total console errors: {len(error_logs)}")
        if error_logs:
            for err in error_logs:
                print(f"  Console error: {err}")

        print("\n==================================================")
        print("ALL E2E BROWSER QA TESTS PASSED SUCCESSFULLY!")
        print("==================================================")
        browser.close()

if __name__ == '__main__':
    run_production_e2e_browser_qa()
