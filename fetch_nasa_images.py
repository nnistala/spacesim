import os
import requests
import time
import urllib.request

def fetch_nasa_images(query, max_images=10):
    print(f"Searching NASA images for: {query}")
    search_url = f"https://images-api.nasa.gov/search?q={urllib.parse.quote(query)}&media_type=image"
    try:
        response = requests.get(search_url)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print(f"Failed to search for {query}: {e}")
        return []

    items = data.get('collection', {}).get('items', [])
    image_urls = []
    
    for item in items:
        if len(image_urls) >= max_images:
            break
            
        href = item.get('href')
        if not href:
            continue
            
        try:
            # The href points to a collection.json containing different resolutions
            img_res = requests.get(href)
            img_res.raise_for_status()
            img_urls = img_res.json()
            
            # Look for orig or large
            best_url = None
            for url in img_urls:
                if url.endswith('~orig.jpg') or url.endswith('~orig.png'):
                    best_url = url
                    break
            
            if not best_url:
                for url in img_urls:
                    if url.endswith('~large.jpg') or url.endswith('~large.png'):
                        best_url = url
                        break
                        
            if not best_url:
                for url in img_urls:
                    if url.endswith('~medium.jpg') or url.endswith('~medium.png'):
                        best_url = url
                        break
            
            if best_url:
                # Replace http with https if needed
                if best_url.startswith('http://'):
                    best_url = 'https://' + best_url[7:]
                image_urls.append(best_url)
                
        except Exception as e:
            print(f"Error fetching image links for {href}: {e}")
            continue
            
    return image_urls

def download_image(url, save_path):
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        with open(save_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        return True
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return False

def main():
    base_dir = "/Users/nagasai/code/VSCode/Projects/ExploreSpace/references"
    if not os.path.exists(base_dir):
        os.makedirs(base_dir)

    search_items = [
        "Sun", "Mercury planet", "Venus planet", "Earth planet", "Moon", 
        "Mars planet", "Jupiter planet", "Saturn planet", "Uranus planet", "Neptune planet",
        "International Space Station", "Tiangong Space Station", "Hubble Space Telescope",
        "GPS Satellite", "GOES-16 Satellite", "Lunar Reconnaissance Orbiter",
        "Mars Reconnaissance Orbiter", "MAVEN satellite", "Apollo 11", "Apollo 17",
        "Perseverance Rover", "Curiosity Rover"
    ]

    for item in search_items:
        # Create folder for item
        folder_name = item.replace(" ", "_").replace("-", "_")
        item_dir = os.path.join(base_dir, folder_name)
        if not os.path.exists(item_dir):
            os.makedirs(item_dir)
            
        print(f"\n--- Processing {item} ---")
        urls = fetch_nasa_images(item, max_images=6) # 6 to be safe in 5-10 range
        print(f"Found {len(urls)} images for {item}")
        
        for i, url in enumerate(urls):
            ext = url.split('.')[-1]
            if len(ext) > 4:
                ext = 'jpg'
            filename = f"{folder_name}_{i+1}.{ext}"
            save_path = os.path.join(item_dir, filename)
            
            print(f"Downloading {filename}...")
            if download_image(url, save_path):
                print(f"Saved {filename}")
            else:
                print(f"Failed to save {filename}")
            time.sleep(0.5) # Be nice to NASA's API

if __name__ == "__main__":
    main()
