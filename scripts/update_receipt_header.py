import base64
from PIL import Image

src_img = r"C:\Users\Kali\.gemini\antigravity-ide\brain\6b419ad0-d477-4ece-ac9a-49fdd2f1b19a\.user_uploaded\media_1788642473820.png"
dest_png = r"e:\Soft\DrCreate\Clinicore\frontend\src\assets\receipt-header.png"
dest_js = r"e:\Soft\DrCreate\Clinicore\frontend\src\utils\receiptHeaderBase64.js"

img = Image.open(src_img)
print("Original size:", img.size, img.mode)

# Save high quality PNG to assets
img.save(dest_png, format="PNG", optimize=True)

# Generate Base64
with open(dest_png, "rb") as f:
    b64_data = base64.b64encode(f.read()).decode("utf-8")

js_content = 'export const RECEIPT_HEADER_IMAGE_BASE64 = "data:image/png;base64,' + b64_data + '";\n'

with open(dest_js, "w", encoding="utf-8") as f:
    f.write(js_content)

print("Updated receipt-header.png and receiptHeaderBase64.js to M. Asif Ashraf Khan! Length:", len(b64_data))
