from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:4321/settings")
    page.wait_for_timeout(2000)

    # Bypass auth
    if page.get_by_text("Continue as Demo Admin").is_visible():
        page.get_by_text("Continue as Demo Admin").click()
        page.wait_for_timeout(1500)
        page.goto("http://localhost:4321/settings")
        page.wait_for_timeout(2000)

    # Click on something that opens the AiKeysModal.
    # Usually it's "AI API Keys" or similar text.
    if page.get_by_text("AI & Services").is_visible():
        page.get_by_text("AI & Services").click()
        page.wait_for_timeout(1000)

    if page.get_by_text("AI Models & APIs").is_visible():
        page.get_by_text("AI Models & APIs").click()
        page.wait_for_timeout(1000)

    # The modal should be open now.
    # Check if the Eye/EyeOff toggle works
    if page.get_by_role("button", name="Show key").is_visible():
        page.get_by_role("button", name="Show key").click()
        page.wait_for_timeout(500)
        page.get_by_role("button", name="Hide key").click()
        page.wait_for_timeout(500)

    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
