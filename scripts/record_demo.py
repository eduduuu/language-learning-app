import asyncio
import os
import glob
import subprocess
import shutil
from playwright.async_api import async_playwright

ARTIFACT_DIR = "/home/edu/.gemini/antigravity/brain/cda7bd16-0c82-4c88-b893-7614e9ba8b07"

CURSOR_INJECTION_SCRIPT = """
(() => {
    if (document.getElementById('playwright-cursor')) return;
    const cursor = document.createElement('div');
    cursor.id = 'playwright-cursor';
    cursor.style.cssText = 'position:fixed;width:20px;height:20px;border-radius:50%;background:rgba(245,158,11,0.9);border:2.5px solid #ffffff;box-shadow:0 0 15px rgba(245,158,11,0.95);pointer-events:none;z-index:9999999;transform:translate(-50%,-50%);transition:transform 0.12s ease-out;';
    document.body.appendChild(cursor);

    window.addEventListener('mousemove', (e) => {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
    });

    window.addEventListener('mousedown', () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(0.7)';
        cursor.style.background = 'rgba(234,88,12,1.0)';
    });

    window.addEventListener('mouseup', () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(1)';
        cursor.style.background = 'rgba(245,158,11,0.9)';
    });
})();
"""

async def smooth_move_to(page, locator, steps=25):
    box = await locator.bounding_box()
    if box:
        target_x = box['x'] + box['width'] / 2
        target_y = box['y'] + box['height'] / 2
        await page.mouse.move(target_x, target_y, steps=steps)
        await page.wait_for_timeout(200)

async def main():
    record_dir = "demo_recording"
    os.makedirs(record_dir, exist_ok=True)
    for f in glob.glob(f"{record_dir}/*.webm"):
        try:
            os.remove(f)
        except OSError:
            pass

    async with async_playwright() as p:
        browser = await p.firefox.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 720},
            record_video_dir=record_dir,
            record_video_size={"width": 1280, "height": 720},
        )
        page = await context.new_page()

        page.on("load", lambda: asyncio.create_task(page.evaluate(CURSOR_INJECTION_SCRIPT)))

        print("1. Opening Home Dashboard...")
        await page.goto("http://localhost:4173/?demo=true")
        await page.wait_for_load_state("networkidle")
        await page.evaluate(CURSOR_INJECTION_SCRIPT)
        await page.wait_for_timeout(1800)

        # Smooth mouse movement over library stats
        await page.mouse.move(450, 220, steps=20)
        await page.wait_for_timeout(800)

        # Scroll to public domain books section
        print("2. Framing Public Domain Classics...")
        read_button = page.locator("button:has-text('Read Now')").first
        await read_button.scroll_into_view_if_needed()
        await page.wait_for_timeout(800)
        await page.evaluate(CURSOR_INJECTION_SCRIPT)

        # Move cursor to 'Read Now' on 走れメロス card
        await smooth_move_to(page, read_button, steps=25)
        await page.wait_for_timeout(600)
        print("3. Clicking 'Read Now' on 走れメロス...")
        await read_button.click()

        # Wait for Reader to parse and open
        print("4. Waiting for Reader to load article...")
        await page.wait_for_selector("article.font-jp", timeout=45000)
        await page.evaluate(CURSOR_INJECTION_SCRIPT)
        await page.wait_for_timeout(2200)

        print("5. Reader loaded! Smooth scrolling reading passage...")
        # Smooth reading scroll
        for _ in range(3):
            await page.mouse.wheel(0, 100)
            await page.wait_for_timeout(700)

        # Find token '激怒' in the article
        print("6. Locating kanji token '激怒'...")
        token_btn = page.locator("article.font-jp button:has-text('激怒')").first
        if not await token_btn.count():
            token_btn = page.locator("article.font-jp button").nth(2)

        await smooth_move_to(page, token_btn, steps=30)
        await page.wait_for_timeout(400)
        print("7. Clicking token to reveal instant dictionary definition...")
        await token_btn.click()
        await page.wait_for_timeout(2500)

        # Move to Word Panel on the right
        print("8. Inspecting Word Panel...")
        word_heading = page.locator("h3:has-text('激怒')").first
        if await word_heading.count():
            await smooth_move_to(page, word_heading, steps=20)
            await page.wait_for_timeout(800)

        # Click Add to SRS
        srs_btn = page.locator("button:has-text('Add to SRS')").first
        if await srs_btn.count():
            print("9. Clicking 'Add to SRS' button...")
            await smooth_move_to(page, srs_btn, steps=20)
            await page.wait_for_timeout(400)
            await srs_btn.click()
            await page.wait_for_timeout(2200)

        # Navigate to Vocabulary / SRS Practice
        print("10. Navigating to Vocabulary Practice...")
        vocab_nav = page.locator("nav button:has-text('Vocabulary')").first
        if await vocab_nav.count():
            await smooth_move_to(page, vocab_nav, steps=25)
            await page.wait_for_timeout(300)
            await vocab_nav.click()
            await page.wait_for_timeout(2000)
            await page.evaluate(CURSOR_INJECTION_SCRIPT)

            # Click Generate card
            gen_btn = page.locator("button:has-text('Generate card')").first
            if await gen_btn.count():
                print("11. Clicking 'Generate card' to start study session...")
                await smooth_move_to(page, gen_btn, steps=25)
                await page.wait_for_timeout(400)
                await gen_btn.click()
                await page.wait_for_timeout(2200)

            # Look for Reveal translation & notes button in Vocabulary
            try:
                await page.wait_for_selector("button:has-text('Reveal translation & notes')", timeout=8000)
            except Exception:
                pass

            reveal_btn = page.locator("button:has-text('Reveal translation & notes'), button:has-text('Show Answer')").first
            if await reveal_btn.count():
                print("12. Clicking 'Reveal translation & notes' to flip flashcard...")
                await smooth_move_to(page, reveal_btn, steps=25)
                await page.wait_for_timeout(500)
                await reveal_btn.click()
                await page.wait_for_timeout(2500)

                # Click "Good" rating
                good_btn = page.locator("button:has-text('Good')").first
                if await good_btn.count():
                    print("13. Rating card as 'Good'...")
                    await smooth_move_to(page, good_btn, steps=20)
                    await page.wait_for_timeout(500)
                    await good_btn.click()
                    await page.wait_for_timeout(2500)

        print("14. Finishing recording session...")
        await page.wait_for_timeout(2000)

        await context.close()
        await browser.close()
        print("Recording complete!")

    # Find recorded webm
    webms = glob.glob(f"{record_dir}/*.webm")
    if not webms:
        print("No webm files found!")
        return

    input_webm = webms[0]
    output_mp4 = os.path.join(ARTIFACT_DIR, "bunmyaku_demo.mp4")
    output_gif = os.path.join(ARTIFACT_DIR, "bunmyaku_demo.gif")
    local_mp4 = "bunmyaku_demo.mp4"
    local_gif = "bunmyaku_demo.gif"

    print("Converting webm to high-quality MP4...")
    subprocess.run([
        "ffmpeg", "-y", "-i", input_webm,
        "-vf", "scale=1280:720",
        "-c:v", "libx264",
        "-preset", "slow",
        "-crf", "22",
        "-pix_fmt", "yuv420p",
        local_mp4
    ], check=True)
    shutil.copy2(local_mp4, output_mp4)
    print("MP4 saved to:", output_mp4)

    print("Generating animated GIF preview...")
    subprocess.run([
        "ffmpeg", "-y", "-i", local_mp4,
        "-vf", "fps=14,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer",
        local_gif
    ], check=True)
    shutil.copy2(local_gif, output_gif)
    print("GIF saved to:", output_gif)
    print("All demo assets generated successfully!")

if __name__ == "__main__":
    asyncio.run(main())
