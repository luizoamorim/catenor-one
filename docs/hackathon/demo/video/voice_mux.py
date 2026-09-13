"""Fit the technical cut to the recorded voice blocks and mux it."""
import subprocess, sys
sys.path.insert(0, '/private/tmp/claude-501/-Users-luizamorim-ETHGLOBAL-ONLINE/5c6add74-1d8b-442b-ac3e-045ef49021cd/scratchpad')
import build_cut as bc
O = bc.OUT
PAD = 0.7
def dur(p): return float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(p)],capture_output=True,text=True).stdout)
voice = {b: dur(O / f'block-{b:02d}.m4a') for b in range(1, 11)}
planned = {}
for (b, src, secs, crop) in bc.SHOTS: planned[b] = planned.get(b, 0) + secs
bc.SHOTS = [(b, src, round(secs * (voice[b] + PAD) / planned[b], 3), crop) for (b, src, secs, crop) in bc.SHOTS]
bc.main()
blocks = {}
for (b, src, secs, crop) in bc.SHOTS: blocks[b] = blocks.get(b, 0) + secs
parts = []
for b in range(1, 11):
    out = O / 'clips' / f'voice-{b:02d}.wav'
    subprocess.run(['ffmpeg','-loglevel','error','-y','-i',str(O / f'block-{b:02d}.m4a'),'-af',f'adelay=300|300,apad=whole_dur={blocks[b]:.3f},atrim=0:{blocks[b]:.3f}','-ar','48000','-ac','2',str(out)],check=True)
    parts.append(out)
lst = O / 'clips' / 'voice.txt'
lst.write_text(''.join(f"file '{p}'\n" for p in parts))
subprocess.run(['ffmpeg','-loglevel','error','-y','-f','concat','-safe','0','-i',str(lst),'-c:a','pcm_s16le',str(O/'clips'/'voice-all.wav')],check=True)
subprocess.run(['ffmpeg','-loglevel','error','-y','-i',str(O/'catenor-one-silent-cut.mp4'),'-i',str(O/'clips'/'voice-all.wav'),'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','192k','-shortest',str(O/'catenor-one-technical-walkthrough.mp4')],check=True)
print({'total_s': round(sum(blocks.values()),1)})
