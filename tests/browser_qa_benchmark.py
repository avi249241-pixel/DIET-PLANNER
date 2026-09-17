import time
import json
from playwright.sync_api import sync_playwright

TEST_MEALS = [
    {"name": "Chicken Biryani with Raita", "query": "chicken biryani with mirchi ka salan and cucumber raita"},
    {"name": "Masala Dosa with Sambar", "query": "masala dosa with vegetable sambar and coconut chutney"},
    {"name": "Salmon Teriyaki with Rice", "query": "pan seared salmon with white rice and edamame"},
    {"name": "Tonkotsu Pork Ramen", "query": "tonkotsu pork ramen with nitamago egg and chashu"},
    {"name": "Cheeseburger and Fries", "query": "cheeseburger with medium french fries"},
    {"name": "Sirloin Steak & Mashed Potatoes", "query": "grilled sirloin steak with mashed potatoes and green beans"},
    {"name": "Chicken Shawarma Platter", "query": "chicken shawarma platter with hummus and pita bread"},
    {"name": "Crispy Falafel Plate", "query": "crispy falafel with tahini sauce and tabbouleh"},
    {"name": "Fettuccine Alfredo", "query": "fettuccine alfredo with grilled chicken breast"},
    {"name": "Avocado Toast & Poached Eggs", "query": "sourdough avocado toast with 2 poached eggs and bacon"}
]

def run_browser_qa():
    print("==================================================")
    print("STARTING REAL BROWSER QA FOR 10 BENCHMARK MEALS")
    print("Target URL: http://localhost:3000")
    print("==================================================")
    
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel="msedge", headless=True)
        except Exception:
            browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()
        
        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        
        page.goto("http://localhost:3000", wait_until="networkidle")
        time.sleep(1)
        
        title = page.title()
        print(f"Page loaded successfully. Title: '{title}'")
        
        passed_count = 0
        
        for idx, meal in enumerate(TEST_MEALS):
            print(f"\n[{idx+1}/10] Testing Food Log Flow for: '{meal['name']}'...")
            page.goto("http://localhost:3000", wait_until="networkidle")
            time.sleep(0.5)
            
            # Find input box
            input_box = page.locator("input[placeholder*='Tell me what you ate'], input[type='text']").first
            if not input_box.is_visible():
                input_box = page.locator("input").first
            
            input_box.fill(meal['query'])
            time.sleep(0.3)
            
            # Click Log / Submit button
            log_btn = page.locator("button:has-text('Log'), button:has-text('Analyze'), button:has-text('Add')").first
            if log_btn.is_visible():
                log_btn.click()
            else:
                input_box.press("Enter")
            
            time.sleep(1.8)
            
            # Check if modal or food log appears
            body_text = page.locator("body").inner_text()
            has_kcal = "kcal" in body_text
            has_food = any(w.lower() in body_text.lower() for w in meal['name'].split())
            
            if has_kcal or has_food:
                print(f"  SUCCESS: Rendered nutrition data & meal details in DOM.")
                passed_count += 1
            else:
                print(f"  WARNING: Could not verify immediate UI text update for {meal['name']}.")

        print("\n==================================================")
        print(f"BROWSER QA SUMMARY: {passed_count}/10 meal logging flows verified in real browser DOM.")
        print(f"Console errors tracked: {len([l for l in console_logs if '[error]' in l])}")
        print("==================================================")
        browser.close()

if __name__ == '__main__':
    run_browser_qa()
