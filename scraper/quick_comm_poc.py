import json
import time
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

def run_blinkit_scraper():
    print("Starting Blinkit Stealth Scraper POC (Selenium + BeautifulSoup)...")
    
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    
    driver = webdriver.Chrome(options=options)
    
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": "Object.defineProperty(navigator, 'webdriver', { get: () => undefined })"
    })

    try:
        print("Navigating to Blinkit...")
        driver.get("https://blinkit.com/")
        time.sleep(3)
        
        # Step 1: Detect location modal
        print("Detecting location input...")
        time.sleep(2)
        try:
            modal_inputs = driver.find_elements(By.CSS_SELECTOR, "input[name='select-locality'], .LocationSearch__Input, input[placeholder*='Search delivery location']")
            if modal_inputs:
                for inp in modal_inputs:
                    if inp.is_displayed():
                        print("Found location input in modal, entering PIN...")
                        inp.send_keys("226010")
                        time.sleep(3)
                        inp.send_keys(Keys.ARROW_DOWN)
                        time.sleep(1)
                        inp.send_keys(Keys.ENTER)
                        break
        except Exception as e:
            print("Could not interact with location modal:", e)
            
        time.sleep(5)
        print("Location set. Navigating to search...")
        
        search_term = "Amul Taaza Milk 500ml"
        
        try:
            search_bar = driver.find_elements(By.CSS_SELECTOR, "div[class*='SearchBar']")
            if search_bar:
                search_bar[0].click()
                time.sleep(2)
        except:
            pass
            
        try:
            search_inputs = driver.find_elements(By.CSS_SELECTOR, "input[placeholder*='Search']")
            for search_input in search_inputs:
                if search_input.is_displayed():
                    search_input.send_keys(search_term)
                    time.sleep(2)
                    search_input.send_keys(Keys.ENTER)
                    print(f"Searching for '{search_term}'...")
                    break
        except Exception as e:
            print("Could not type in search bar:", e)

        time.sleep(6)
        
        # Step 3: Extract results using BeautifulSoup
        print("Extracting results...")
        soup = BeautifulSoup(driver.page_source, 'html.parser')
        
        # Find all elements that contain the rupee symbol
        price_elements = soup.find_all(string=lambda text: text and '₹' in text)
        
        extracted_data = []
        for price_elem in price_elements:
            try:
                # Go up to the parent card container
                parent = price_elem.parent
                for _ in range(5): # Go up a few levels
                    if parent and parent.name == 'div' and 'ADD' in parent.text:
                        break
                    if parent:
                        parent = parent.parent
                        
                if parent and 'ADD' in parent.text:
                    text_content = parent.get_text(separator='|', strip=True)
                    parts = text_content.split('|')
                    
                    price = ""
                    title = ""
                    size = ""
                    
                    for p in parts:
                        if '₹' in p and not price:
                            price = p
                        elif len(p) > 5 and p != 'ADD' and 'MINS' not in p and not title:
                            title = p
                        elif p.lower() in ['g', 'kg', 'ml', 'l', 'pcs'] or any(char.isdigit() for char in p) and '₹' not in p and 'ADD' not in p:
                            if not size and 'MINS' not in p:
                                size = p
                                
                    img = parent.find('img')
                    imgUrl = img['src'] if img and 'src' in img.attrs else ""
                    
                    if title and price:
                        # Avoid duplicates
                        if not any(d['name'] == title for d in extracted_data):
                            extracted_data.append({
                                'name': title,
                                'size': size,
                                'price': price,
                                'imageUrl': imgUrl
                            })
            except Exception:
                continue
                
        if extracted_data:
            print(f"Successfully scraped {len(extracted_data)} items!")
            print("Top Results:")
            for item in extracted_data[:3]:
                print(json.dumps(item, indent=2))
        else:
            print("No products found via BeautifulSoup extraction.")
            # Print page title and some text to prove bot bypass worked
            print("Page Title:", driver.title)
            print("Body Text Preview:", driver.find_element(By.TAG_NAME, "body").text[:200].replace('\\n', ' '))
            driver.save_screenshot("blinkit_debug.png")
            
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    run_blinkit_scraper()
