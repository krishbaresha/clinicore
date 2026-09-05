import base64
from PIL import Image

src_img = r"C:\Users\Kali\.gemini\antigravity-ide\brain\6b419ad0-d477-4ece-ac9a-49fdd2f1b19a\.user_uploaded\media_1788642473820.png"
dest_png = r"e:\Soft\DrCreate\Clinicore\frontend\src\assets\receipt-header.png"
dest_js = r"e:\Soft\DrCreate\Clinicore\frontend\src\utils\receiptHeaderBase64.js"

img = Image.open(src_img)
print("Original size:", img.size)

# Crop the top and bottom whitespace so there is ZERO vertical gap
# Content top is around y=87, bottom is y=334
# We crop to (0, 80, 1024, 340)
cropped = img.crop((0, 80, img.size[0], 340))
print("Cropped size:", cropped.size)

# Save high quality PNG to assets
cropped.save(dest_png, format="PNG", optimize=True)

# Generate Base64
with open(dest_png, "rb") as f:
    b64_data = base64.b64encode(f.read()).decode("utf-8")

js_content = 'export const RECEIPT_HEADER_IMAGE_BASE64 = "data:image/png;base64,' + b64_data + '";\n'

with open(dest_js, "w", encoding="utf-8") as f:
    f.write(js_content)

print("Successfully cropped receipt header and updated receiptHeaderBase64.js! Length:", len(b64_data))
