"""Apple-style animated titles over the Luma clip: soft rise + blur-in, lighter weight, centred; no logo."""
import subprocess, shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1920, 1080, 30
LUMA = Path.home() / 'Movies/catenor-one-final-demo/luma'
SRC, FR = LUMA / 'scene2.mp4', LUMA / 'frames'
OUT = LUMA.parent / 'one-did-every-door-landing.mp4'
SF = '/System/Library/Fonts/SFNS.ttf'

def font(size, weight):
    f = ImageFont.truetype(SF, size); f.set_variation_by_name(weight); return f

def ease(t): t = max(0.0, min(1.0, t)); return 1 - (1 - t) ** 3

# (text, start, end, size, weight, y)
TITLES = [
    ('One identity.', 0.5, 3.3, 84, 'Medium', 300),
    ('Every door it’s allowed through.', 3.7, 6.9, 76, 'Medium', 300),
    ('…and none it isn’t.', 7.3, 10.0, 84, 'Medium', 300),
]
END_START, END_LEN = 10.0, 2.6  # white fade + closing line

def title_layer(text, size, weight, alpha, rise, blur, y):
    f = font(size, weight)
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).text((W / 2, y + rise), text, font=f, fill=255, anchor='mm')
    halo_mask = m.filter(ImageFilter.GaussianBlur(16)).point(lambda v: int(v * 0.75 * alpha))
    text_mask = (m.filter(ImageFilter.GaussianBlur(blur)) if blur > 0.2 else m).point(lambda v: int(v * alpha))
    out = Image.new('RGBA', (W, H), (255, 255, 255, 0))
    out.paste(Image.new('RGBA', (W, H), (255, 255, 255, 255)), (0, 0), halo_mask)
    out.paste(Image.new('RGBA', (W, H), (29, 29, 31, 255)), (0, 0), text_mask)
    out.putalpha(max_mask(halo_mask, text_mask))
    return out

def max_mask(a, b):
    from PIL import ImageChops
    return ImageChops.lighter(a, b)

def main():
    if FR.exists(): shutil.rmtree(FR)
    FR.mkdir(parents=True)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(SRC), '-t', '10', '-vf',
                    f'scale={W}:{H}:flags=lanczos,fps={FPS}', str(FR / 's%04d.png')], check=True)
    src = sorted(FR.glob('s*.png'))
    last = Image.open(src[-1]).convert('RGB')
    n_total = int((END_START + END_LEN) * FPS)
    for i in range(n_total):
        t = i / FPS
        base = Image.open(src[min(i, len(src) - 1)]).convert('RGBA') if t < END_START else last.convert('RGBA')
        if t >= END_START:  # fade the last frame to white, then the closing line
            k = ease((t - END_START) / 0.8)
            base = Image.blend(base, Image.new('RGBA', (W, H), (251, 251, 253, 255)), k)
            a = ease((t - END_START - 0.5) / 0.9)
            if a > 0:
                base = Image.alpha_composite(base, title_layer('One DID. Every door.', 104, 'Semibold', a, 24 * (1 - a), 10 * (1 - a), H / 2))
        else:
            for text, st, en, size, weight, y in TITLES:
                if st <= t <= en:
                    a_in = ease((t - st) / 0.7)
                    a_out = 1 - ease((t - (en - 0.45)) / 0.45)
                    a = min(a_in, a_out)
                    base = Image.alpha_composite(base, title_layer(text, size, weight, a, 22 * (1 - a_in), 9 * (1 - a_in), y))
        base.convert('RGB').save(FR / f'o{i:04d}.jpg', quality=92)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-framerate', str(FPS), '-i', str(FR / 'o%04d.jpg'),
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', str(OUT)], check=True)
    print(OUT)

if __name__ == '__main__':
    main()
