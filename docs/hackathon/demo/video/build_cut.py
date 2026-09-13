"""Silent 1080p cut for the Catenor One demo video (clean + narration-guide versions)."""
import json, subprocess, sys, textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageStat

ROOT = Path('/Users/luizamorim/ETHGLOBAL_ONLINE/catenor-one')
SHOTS_DIR = ROOT / 'artifacts/final-demo/screenshots'
OUT = Path.home() / 'Movies/catenor-one-final-demo'
FR, CL = OUT / 'frames', OUT / 'clips'
W, H = 1920, 1080
SF = '/System/Library/Fonts/SFNS.ttf'
LOGOS = Path('/private/tmp/claude-501/-Users-luizamorim-ETHGLOBAL-ONLINE/5c6add74-1d8b-442b-ac3e-045ef49021cd/scratchpad/logos')
CMD = {
 '11-after-terminal.png': 'scripts/demo/11-admit-root-trust-anchor.sh',
 '21-terminal.png': 'scripts/demo/21-trust-anchor-authorize-sponsor.sh',
 '44-terminal.png': 'scripts/demo/44-check-offering-eligibility.sh',
 '63-after-verify-hedera-entitlements.png': 'scripts/demo/91-verify-hedera.sh',
 '70-terminal.png': 'scripts/demo/70-create-distribution-agent.sh',
 '72-terminal.png': 'scripts/demo/72-sponsor-delegate-distribution-capability.sh',
 '82-terminal.png': 'scripts/demo/82-run-confidential-distribution.sh',
 '83-terminal.png': 'scripts/demo/83-execute-approved-distribution.sh --live',
 '91-verify-hedera-final.png': 'scripts/demo/91-verify-hedera.sh',
 '99-verify-complete-demo-stages.png': 'scripts/demo/99-verify-complete-demo.sh',
}
MONO = '/System/Library/Fonts/SFNSMono.ttf'

def font(size, path=SF):
    return ImageFont.truetype(path, size)

NARR = {
 1: "This is Catenor One, the first reference implementation of Catenor Protocol. Tokenized assets prove who holds them. They don't prove who may be paid today. In our demo, one investor is entitled to 4 HBAR and is paid zero: he still holds his tokens, but he is no longer eligible. Here's how.",
 2: "Four technologies, each with one job. Catenor holds identity and scoped authority. Chainlink's Confidential Workflow reads private KYC evidence inside a TEE, and decides. Privy constrains which key can sign what: the Trust Anchor's signing keys, the SPV and Agent wallets, and the investors' receive-only wallets. And Hedera's Asset Tokenization Studio runs the asset, verifiable by anyone.",
 3: "Trust starts with admission. The representative's KYC, from the Sumsub sandbox, plus a mocked company check, is read inside our deployed Confidential Workflow. The secrets come from the Vault DON, the Sumsub calls happen in the enclave, and only facts and a commitment come out. The policy says ALLOW, a separate bootstrap key endorses, and the Trust Anchor is valid.",
 4: "The Trust Anchor grants the Sponsor five scoped capabilities. Outside that scope it's DENY. Only after TOKENIZE_ASSET is allowed does the SPV get a Privy wallet, and its policy can only sign on Hedera testnet, to the ATS Factory.",
 5: "Two investors, Lisa and Bart, pass KYC in the Sumsub sandbox. The TEE verifies their evidence, and the Trust Anchor issues W3C credentials. Their presentations are then checked confidentially against the offering policy: Lisa may buy 600 units, Bart 400.",
 6: "On Hedera testnet, the SPV's Privy wallet deploys an ATS equity, issues exactly the approved units, 600 and 400, and sets a dividend. ATS computes the entitlements by ownership: Lisa 6, Bart 4.",
 7: "A Distribution Agent gets a wallet, but no authority: DENY. A relationship alone: still DENY. Only a delegated EXECUTE_DISTRIBUTION works, and it can never exceed the Sponsor's own. Its Privy policy can only pay Lisa or Bart, up to 20 HBAR.",
 8: "Now Bart gets sanctioned. He still holds 400 units and a valid credential. At distribution time, the TEE re-checks today's evidence: Lisa, PAY 6; Bart, HOLD 4. The raw evidence never leaves the enclave. The Agent pays Lisa 6 HBAR on-chain. For Bart, no transaction is built and no signature is even requested.",
 9: "And everyone can check it: five executions on the deployed workflow, six testnet transactions, Lisa entitled to 6 and paid 6, Bart entitled to 4 and paid zero, and a valid audit chain. Twenty-four out of twenty-four stages.",
 10: "Wallets are accounts. Credentials are claims. Authority is scoped. Identity persists. That's Catenor.",
}

# (block, source, seconds, crop box as fractions or None)
SHOTS = [
 (1, 'card:logo', 5, None),
 (1, 'logos/hero.png', 7, None),
 (1, 'logos/thesis.png', 10, None),
 (2, 'card:partners', 25, None),
 (3, '11-before-cre-workflow.png', 6, None),
 (3, '11-after-terminal.png', 9, None),
 (3, '11-after-cre-execution-events.png', 10, None),
 (4, '21-terminal.png', 5, (0, 0.15, 0.50, 0.45)),
 (4, '21-terminal.png', 5, (0, 0.80, 0.50, 0.97)),
 (4, '30-after-privy-policy-spv-json.png', 10, None),
 (5, '44-after-sumsub-both-green.png', 7, None),
 (5, '42-after-cre-executions.png', 8, None),
 (5, '44-terminal.png', 5, (0, 0.15, 0.55, 0.30)),
 (5, '44-terminal.png', 5, (0, 0.555, 0.55, 0.70)),
 (6, '60-after-hashscan-deploy-tx.png', 12, None),
 (6, '63-after-verify-hedera-entitlements.png', 13, (0, 0.62, 0.95, 0.98)),
 (7, '70-terminal.png', 6, None),
 (7, '72-terminal.png', 7, None),
 (7, '70-after-privy-agent-policy-json.png', 7, None),
 (8, '80-after-sumsub-bart-red.png', 7, None),
 (8, '82-terminal.png', 4, (0, 0.28, 0.55, 0.375)),
 (8, '82-terminal.png', 6, (0, 0.495, 0.55, 0.72)),
 (8, '82-after-cre-execution-events.png', 6, None),
 (8, '83-terminal.png', 6, None),
 (8, '83-after-hashscan-payout-tx.png', 6, None),
 (9, '99-after-cre-five-executions.png', 7, None),
 (9, '91-verify-hedera-final.png', 6, (0, 0.62, 0.92, 0.97)),
 (9, '99-verify-complete-demo-stages.png', 7, None),
 (10, 'card:closing', 10, None),
]

def card(kind):
    im = Image.new('RGB', (W, H), '#ffffff')
    d = ImageDraw.Draw(im)
    ink, muted, blue = '#1d1d1f', '#6e6e73', '#0071e3'
    if kind == 'title':
        d.text((150, 250), 'ETHOnline 2026 · Catenor One', font=font(36), fill=muted)
        d.text((145, 330), 'Possession ≠', font=font(150), fill=ink)
        d.text((145, 500), 'current eligibility.', font=font(150), fill=ink)
        d.text((150, 730), 'The first reference implementation of Catenor Protocol.', font=font(44), fill=muted)
        d.text((150, 880), 'Chainlink CRE  ·  Privy  ·  Hedera ATS', font=font(38), fill=blue)
    elif kind == 'logo':
        social = Image.open(LOGOS / 'catenor-social.png').convert('RGB')
        im.paste(social.getpixel((8, 8)), (0, 0, W, H))
        src = social.crop((170, 140, 1100, 418))
        src = src.resize((int(src.width * 1.5), int(src.height * 1.5)), Image.LANCZOS)
        im.paste(src, ((W - src.width) // 2, 200))
        d.text((W // 2, 760), 'Catenor One', font=font(72), fill=ink, anchor='mm')
        d.text((W // 2, 850), 'The first reference implementation of Catenor Protocol  ·  ETHOnline 2026', font=font(34), fill=muted, anchor='mm')
    elif kind == 'partners':
        d.text((120, 90), 'Four technologies. One job each.', font=font(72), fill=ink)
        cols = [
          ('catenor', 'Catenor', 'identity + scoped authority',
           ['did:catenor canonical identity', 'W3C credentials & presentations', 'capabilities, delegation, policy', 'hash-chained audit']),
          ('chainlink', 'Chainlink CRE', 'confidential, current eligibility',
           ['deployed Confidential Workflow (TEE)', 'Vault DON secrets → Sumsub in the enclave', 'decides admission, eligibility, PAY/HOLD', 'only facts + commitments leave']),
          ('privy', 'Privy', 'which key can sign what',
           ['Trust Anchor & Sponsor keys: sign only', 'SPV wallet: ATS Factory + its equity', 'Agent wallet: only Lisa/Bart, ≤ 20 HBAR', 'investors: receive-only wallets']),
          ('hedera', 'Hedera ATS', 'the asset lifecycle',
           ['tokenized SPV equity on testnet', 'issuance, corporate-action role, dividend', 'payout to the eligible holder', 'verifiable on HashScan / Mirror Node']),
        ]
        x0, cw = 120, 420
        for i, (key, name, role, bullets) in enumerate(cols):
            x = x0 + i * cw
            d.line((x, 230, x + cw - 40, 230), fill='#d2d2d7', width=2)
            logo = None
            if key == 'catenor':
                logo = Image.open(LOGOS / 'catenor-social.png').convert('RGB').crop((180, 150, 405, 420))
            elif key == 'chainlink':
                logo = Image.open(ROOT / '.agents/skills/chainlink-cre-skill/assets/chainlink-icon.png').convert('RGBA')
            elif key == 'hedera':
                logo = Image.open(LOGOS / 'hedera.svg.png').convert('RGBA')
            elif key == 'privy':
                for cand in (Path.home() / 'Downloads/privy-logo.png', LOGOS / 'privy.png'):
                    if cand.exists():
                        logo = Image.open(cand).convert('RGBA'); break
            if logo is not None:
                from PIL import ImageOps
                gray = ImageOps.invert(logo.convert('RGB').convert('L'))
                bbox = gray.point(lambda v: 255 if v > 24 else 0).getbbox()
                if bbox:
                    logo = logo.crop(bbox)
                logo.thumbnail((130, 130), Image.LANCZOS)
                im.paste(logo, (x, 270), logo if logo.mode == 'RGBA' else None)
            else:
                d.rounded_rectangle((x, 270, x + 130, 400), 28, fill='#1d1d1f')
                d.text((x + 65, 335), 'privy', font=font(40), fill='white', anchor='mm')
            d.text((x, 440), name, font=font(46), fill=ink)
            d.text((x, 505), role, font=font(28), fill='#0071e3')
            y = 575
            for b in bullets:
                for j, line in enumerate(textwrap.wrap(b, 26)):
                    d.text((x + (0 if j == 0 else 22), y), ('• ' if j == 0 else '') + line, font=font(27), fill=muted)
                    y += 38
                y += 14
    elif kind == 'layers':
        d.text((150, 130), 'Four layers', font=font(96), fill=ink)
        rows = [('Catenor', 'identity + scoped authority'),
                ('Chainlink CRE (TEE)', 'confidential, current eligibility'),
                ('Privy', 'policy-bounded signing'),
                ('Hedera ATS', 'the asset lifecycle')]
        y = 330
        for i, (a, b) in enumerate(rows):
            d.line((150, y - 30, W - 150, y - 30), fill='#d2d2d7', width=2)
            d.text((150, y), f'0{i + 1}', font=font(30), fill='#86868b')
            d.text((260, y - 8), a, font=font(60), fill=ink)
            d.text((1000, y + 4), b, font=font(46), fill=muted)
            y += 170
    elif kind == 'closing':
        lines = ['Wallets are accounts.', 'Credentials are claims.', 'Authority is scoped.', 'Identity persists.']
        y = 170
        for l in lines:
            d.text((150, y), l, font=font(104), fill=ink)
            y += 150
        d.text((150, 850), 'github.com/luizoamorim/catenor-one   ·   catenor.xyz', font=font(40), fill=blue)
        d.text((150, 920), 'Sumsub sandbox · synthetic company KYB mock · Hedera testnet', font=font(30), fill=muted)
    return im

def shot_frame(src, crop):
    path = LOGOS / src.split('/', 1)[1] if src.startswith('logos/') else SHOTS_DIR / src
    im = Image.open(path).convert('RGB')
    cmd = CMD.get(src)
    if crop:
        w, h = im.size
        im = im.crop((int(crop[0] * w), int(crop[1] * h), int(crop[2] * w), int(crop[3] * h)))
    dark = sum(ImageStat.Stat(im.convert('L')).mean) < 110
    bg = '#1e1f24' if dark else '#f5f5f7'
    canvas = Image.new('RGB', (W, H), bg)
    maxw, maxh = W - 120, H - (170 if cmd else 80)
    im.thumbnail((maxw, maxh), Image.LANCZOS) if (im.width > maxw or im.height > maxh) else None
    if im.width < maxw and im.height < maxh:  # upscale small crops for legibility
        s = min(maxw / im.width, maxh / im.height)
        im = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
    top = (H - im.height) // 2 + (45 if cmd else 0)
    canvas.paste(im, ((W - im.width) // 2, top))
    if cmd:
        d = ImageDraw.Draw(canvas)
        bx0, bx1 = (W - im.width) // 2, (W + im.width) // 2
        d.rectangle((bx0, top - 78, bx1, top - 8), fill='#2b2d33')
        for k, c in enumerate(('#ff5f57', '#febc2e', '#28c840')):
            d.ellipse((bx0 + 22 + k * 30, top - 52, bx0 + 40 + k * 30, top - 34), fill=c)
        d.text((bx0 + 130, top - 43), '$ ' + cmd, font=font(30, MONO), fill='#9ef0a8', anchor='lm')
    return canvas

def guide(frame, block):
    g = frame.copy()
    d = ImageDraw.Draw(g, 'RGBA')
    d.rectangle((0, H - 250, W, H), fill=(0, 0, 0, 205))
    d.text((60, H - 235), f'[{block}]  READ:', font=font(26), fill='#ffd60a')
    y = H - 195
    for line in textwrap.wrap(NARR[block], 120)[:5]:
        d.text((60, y), line, font=font(32), fill='white')
        y += 38
    return g

def encode(png, secs, out):
    fo = max(secs - 0.3, 0)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-loop', '1', '-t', str(secs), '-i', str(png),
                    '-vf', f'fade=t=in:st=0:d=0.3,fade=t=out:st={fo}:d=0.3,format=yuv420p',
                    '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-tune', 'stillimage', '-crf', '18',
                    str(out)], check=True)

def main():
    FR.mkdir(parents=True, exist_ok=True); CL.mkdir(parents=True, exist_ok=True)
    lists = {'clean': [], 'guide': []}
    total = 0
    for i, (block, src, secs, crop) in enumerate(SHOTS):
        frame = card(src.split(':')[1]) if src.startswith('card:') else shot_frame(src, crop)
        for kind, img in (('clean', frame), ('guide', guide(frame, block))):
            png = FR / f'{i:02d}-{kind}.png'
            img.save(png)
            mp4 = CL / f'{i:02d}-{kind}.mp4'
            encode(png, secs, mp4)
            lists[kind].append(mp4)
        total += secs
    for kind, clips in lists.items():
        lst = CL / f'{kind}.txt'
        lst.write_text(''.join(f"file '{c}'\n" for c in clips))
        name = 'catenor-one-silent-cut.mp4' if kind == 'clean' else 'catenor-one-narration-guide.mp4'
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(lst),
                        '-c', 'copy', str(OUT / name)], check=True)
    print(json.dumps({'shots': len(SHOTS), 'seconds': total}))

if __name__ == '__main__':
    main()
