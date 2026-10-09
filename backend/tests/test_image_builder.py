"""Utility used by test_sehat_backend.py to build a realistic medicine package JPEG with text."""
import io
import base64
from PIL import Image, ImageDraw, ImageFont


def build_medicine_jpeg_base64(text_lines=None) -> str:
    text_lines = text_lines or [
        "METFORMIN 500 mg",
        "Film-coated Tablets",
        "Mfg: ACME Pharma",
        "Batch: AB1234  Exp: 12/2027",
        "Rx only  Take with food",
    ]
    # background with gradient/texture so it has features
    img = Image.new("RGB", (640, 400), (235, 240, 230))
    draw = ImageDraw.Draw(img)
    # add some rectangles for visual variance (packaging look)
    draw.rectangle([10, 10, 630, 390], outline=(10, 60, 10), width=4)
    draw.rectangle([20, 20, 620, 90], fill=(10, 90, 40))
    draw.rectangle([20, 300, 620, 380], fill=(230, 230, 210))
    # add noise lines
    for y in range(100, 290, 8):
        draw.line([(30, y), (610, y)], fill=(210, 220, 210), width=1)

    try:
        font_big = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36)
        font_med = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)
    except Exception:
        font_big = ImageFont.load_default()
        font_med = ImageFont.load_default()

    draw.text((40, 30), text_lines[0], fill=(255, 255, 255), font=font_big)
    y = 110
    for line in text_lines[1:]:
        draw.text((40, y), line, fill=(20, 40, 20), font=font_med)
        y += 36

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode("ascii")


if __name__ == "__main__":
    b = build_medicine_jpeg_base64()
    print(len(b))
