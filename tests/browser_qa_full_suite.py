import time
import os
import sys
from playwright.sync_api import sync_playwright

def run_suite():
    artifact_dir = r'C:\Users\code\.gemini\antigravity\brain\1c2e7cf2-40c3-4da4-b0ea-ca0e713600a2'
    os.makedirs(artifact_dir, exist_ok=True)
    
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel='msedge', headless=True)
        except Exception:
            browser = p.chromium.launch(headless=True)
            
        context = browser.new_context(viewport={'width': 1280, 'height': 820})
        page = context.new_page()
        
        errors = []
        page.on('console', lambda msg: errors.append(f'[{msg.type}] {msg.text}') if msg.type == 'error' else None)
        
        print('1. Navigating to localhost:3000...', flush=True)
        page.goto('http://localhost:3000', wait_until='domcontentloaded')
        time.sleep(2)
        
        print('2. Clicking Instant 1-Click Guest Demo...', flush=True)
        demo_btn = page.locator("button:has-text('Instant 1-Click Guest Demo')").first
        demo_btn.wait_for(timeout=10000)
        demo_btn.click()
        time.sleep(2)
        
        # Open Voice Modal
        print('3. Opening Voice Meal Logger Modal...', flush=True)
        page.locator("header button[title*='Voice Meal Logger']").first.click()
        time.sleep(1)
        page.screenshot(path=os.path.join(artifact_dir, 'screen_09_voice_modal.png'))
        
        # Close voice modal by clicking its top-right X button
        print('4. Closing Voice Modal...', flush=True)
        page.locator(".fixed.z-50 button").first.click()
        time.sleep(1)
        
        # Open Barcode Modal
        print('5. Opening Barcode Scanner Modal...', flush=True)
        page.locator("header button[title*='Scan Barcode']").first.click()
        time.sleep(1.5)
        page.screenshot(path=os.path.join(artifact_dir, 'screen_10_barcode_modal.png'))
        
        # Close barcode modal
        print('6. Closing Barcode Modal...', flush=True)
        page.locator(".fixed.z-50 button").first.click()
        time.sleep(1)
        
        print('=== QA SUITE RUN COMPLETE ===', flush=True)
        print(f'Screenshots saved to: {artifact_dir}', flush=True)
        print(f'Browser Console Errors ({len(errors)}):', flush=True)
        for err in errors:
            print(f'  {err}', flush=True)
            
        browser.close()

if __name__ == '__main__':
    run_suite()
