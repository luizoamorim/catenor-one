"""15 s loop: 'One DID. Every door.' — minimal motion design, 1920x1080 @ 30 fps."""
import math, subprocess, shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H, FPS, N = 1920, 1080, 30, 450
OUT = Path.home() / 'Movies/catenor-one-final-demo/one-did'
LOGO = Path('/private/tmp/claude-501/-Users-luizamorim-ETHGLOBAL-ONLINE/5c6add74-1d8b-442b-ac3e-045ef49021cd/scratchpad/logos/catenor-lockup.png')
SF, MONO = '/System/Library/Fonts/SFNS.ttf', '/System/Library/Fonts/SFNSMono.ttf'
BG, INK, MUTED, BLUE, GREEN, RED = '#fbfbfd', '#1d1d1f', '#86868b', '#0071e3', '#16883f', '#d70015'
f = lambda s, p=SF: ImageFont.truetype(p, s)
def ease(t): t = max(0, min(1, t)); return t * t * (3 - 2 * t)
def seg(i, a, b): return ease((i - a) / (b - a))
def mix(c1, c2, t):
    a = [int(c1[k:k+2], 16) for k in (1, 3, 5)]; b = [int(c2[k:k+2], 16) for k in (1, 3, 5)]
    return tuple(int(a[j] + (b[j] - a[j]) * t) for j in range(3))

DOORS = [('Bank', 'credential ✓', True), ('Fund', 'credential ✓', True), ('Exchange', 'capability ✓', True),
         ('Marketplace', 'policy ✓', True), ('Agent', 'capability ✓', True), ('Payout', 'not eligible today', False)]
DX = [260 + k * 280 for k in range(6)]
DY, DW, DH = 250, 170, 270
CARD_Y = 760
logo = Image.open(LOGO).convert('RGB')
lbg = logo.getpixel((6, 6))
BG = '#%02x%02x%02x' % lbg

def card(d, cx, cy, s, alpha):
    w, h = 560 * s, 130 * s
    if w < 4: return
    col = mix(BG, '#ffffff', 1)
    d.rounded_rectangle((cx - w/2, cy - h/2, cx + w/2, cy + h/2), radius=max(6, 34 * s), fill=col,
                        outline=mix(BG, INK, alpha), width=3)
    if alpha > 0.05 and s > 0.8:
        d.ellipse((cx - w/2 + 30, cy - 14, cx - w/2 + 58, cy + 14), fill=mix(BG, BLUE, alpha))
        d.text((cx - w/2 + 80, cy - 20), 'did:catenor:656d…3cab', font=f(36, MONO), fill=mix(BG, INK, alpha))
        d.text((cx - w/2 + 80, cy + 22), 'one canonical identity', font=f(22), fill=mix(BG, MUTED, alpha))

def door(d, x, label, chip, ok, opened, vis):
    if vis <= 0: return
    fr = mix(BG, INK, vis)
    x0, y0 = x - DW/2, DY
    if opened > 0:
        d.rectangle((x0, y0, x0 + DW, y0 + DH), fill=mix(BG, '#e8f1ff' if ok else '#fde8ea', opened * vis))
    d.rectangle((x0, y0, x0 + DW, y0 + DH), outline=fr, width=4)
    pw = DW * (1 - 0.82 * opened) if ok else DW
    d.rectangle((x0, y0, x0 + pw, y0 + DH), fill=mix(BG, '#2c2c2e', vis))
    d.ellipse((x0 + pw - 26, y0 + DH/2 - 7, x0 + pw - 12, y0 + DH/2 + 7), fill=mix(BG, '#c7c7cc', vis))
    d.text((x, y0 + DH + 34), label, font=f(30), fill=fr, anchor='mm')
    if opened > 0.05:
        t = ease(opened); cw = 26 * len(chip) * 0.55 + 40
        col = GREEN if ok else RED
        d.rounded_rectangle((x - cw/2, y0 - 70 + 12 * (1 - t), x + cw/2, y0 - 26 + 12 * (1 - t)), radius=22,
                            fill=mix(BG, col, t * vis))
        d.text((x, y0 - 48 + 12 * (1 - t)), chip, font=f(24), fill=mix(col, '#ffffff', t * vis), anchor='mm')

def frame(i):
    im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
    # scene 1: dot -> card (0-2 s)
    if i < 60:
        g = seg(i, 0, 25); s = seg(i, 22, 55)
        if s < 0.05:
            r = 16 * g
            d.ellipse((W/2 - r, H/2 - r, W/2 + r, H/2 + r), fill=BLUE)
        else:
            card(d, W/2, H/2, s, seg(i, 30, 58))
    # scene 2: doors (2-9 s)
    elif i < 285:
        vis = seg(i, 60, 80) * (1 - seg(i, 265, 285))
        tmove = seg(i, 70, 255)
        cx = 330 + (1600 - 330) * tmove
        cy = H/2 + (CARD_Y - H/2) * seg(i, 60, 80)
        for k, (lab, chip, ok) in enumerate(DOORS):
            reach = (cx - (DX[k] - 70)) / 90
            door(d, DX[k], lab, chip, ok, max(0, min(1, reach)) * (1 if ok else 1), vis)
        d.line((120, CARD_Y + 90, W - 120, CARD_Y + 90), fill=mix(BG, '#d2d2d7', vis), width=2)
        card(d, cx, cy, 1, vis)
    # scene 3: text (9.5-13 s)
    elif i < 390:
        lines = [('Wallets change.', MUTED, 285), ('Providers change.', MUTED, 310), ('Identity persists.', INK, 335)]
        out = 1 - seg(i, 375, 390)
        for k, (txt, col, st) in enumerate(lines):
            a = seg(i, st, st + 18) * out
            d.text((W/2, 340 + k * 170 + 30 * (1 - a)), txt, font=f(120), fill=mix(BG, col, a), anchor='mm')
    # scene 4: logo + tagline (13-15 s)
    else:
        a = seg(i, 390, 410) * (1 - seg(i, 440, 450))
        lg = logo.resize((int(logo.width * 1.1), int(logo.height * 1.1)), Image.LANCZOS)
        tint = Image.new('RGB', lg.size, BG)
        im.paste(Image.blend(tint, lg, a), ((W - lg.width) // 2, 250))
        d.rectangle(((W - lg.width) // 2, 250 + lg.height - 18, (W + lg.width) // 2, 250 + lg.height), fill=BG)
        d.text((W/2, 780), 'One DID. Every door.', font=f(84), fill=mix(BG, INK, seg(i, 405, 425) * (1 - seg(i, 440, 450))), anchor='mm')
    return im

def main():
    if OUT.exists(): shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    for i in range(N):
        frame(i).save(OUT / f'{i:04d}.png')
    mp4 = OUT.parent / 'one-did-every-door.mp4'
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-framerate', str(FPS), '-i', str(OUT / '%04d.png'),
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-movflags', '+faststart', str(mp4)], check=True)
    frame(200).save(OUT.parent / 'one-did-poster.png')
    print(mp4)

if __name__ == '__main__':
    main()
