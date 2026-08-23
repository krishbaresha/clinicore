from PIL import Image
import base64
import io

img = Image.open('src/assets/clinic-logo.png')
print("Original size:", img.size)

if img.mode == 'RGBA':
    bbox = img.getbbox()
    print("Bounding box:", bbox)
    if bbox:
        # Add slight 4px padding
        w, h = img.size
        pad_bbox = (
            max(0, bbox[0] - 8),
            max(0, bbox[1] - 8),
            min(w, bbox[2] + 8),
            min(h, bbox[3] + 8)
        )
        cropped = img.crop(pad_bbox)
        
        # Resize to crisp optimal 380x150 width bounds
        cropped.thumbnail((380, 160), Image.Resampling.LANCZOS)
        print("Optimized size:", cropped.size)
        cropped.save('src/assets/clinic-logo-cropped.png', 'PNG')
        
        buffered = io.BytesIO()
        cropped.save(buffered, format='PNG')
        b64_str = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        with open('src/utils/clinicLogoBase64.js', 'w', encoding='utf-8') as f:
            f.write(f'export const CLINIC_LOGO_BASE64 = "data:image/png;base64,{b64_str}";\n')
        print("SUCCESSFULLY generated tight-cropped clinicLogoBase64.js!")
