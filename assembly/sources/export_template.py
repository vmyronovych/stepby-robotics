#!/usr/bin/env python3
"""Export a measured third-plate profile only. Never use demonstration coordinates."""
import json,math,sys
from pathlib import Path
p=Path(__file__).resolve().parent
g=json.loads((p/'geometry.json').read_text());m=g['measured']
required=['plate_length','plate_width','plate_thickness','plate_outline_xy','post_centres_xy','clear_gap','battery_size_xyz','ground_clearance']
missing=[k for k in required if m.get(k) is None]
if missing:
    sys.exit('EXPORT REFUSED: actual measurements TBD: '+', '.join(missing))
outline=m['plate_outline_xy'];posts=m['post_centres_xy']
if len(outline)<4 or len(posts)!=4:sys.exit('EXPORT REFUSED: measured outline and exactly four verified support centres required')
def segment_distance(p,a,b):
    dx=b[0]-a[0];dy=b[1]-a[1];v=dx*dx+dy*dy
    t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/v))if v else 0
    return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
for point in posts:
    if min(segment_distance(point,a,b) for a,b in zip(outline,outline[1:]+outline[:1]))<6:
        sys.exit('EXPORT REFUSED: a mounting centre is less than 6 mm from an outline edge')
x0=min(x for x,y in outline);x1=max(x for x,y in outline);y0=min(y for x,y in outline);y1=max(y for x,y in outline)
if abs((x1-x0)-m['plate_width'])>1 or abs((y1-y0)-m['plate_length'])>1:sys.exit('EXPORT REFUSED: dimensions disagree with outline')
w=x1-x0+20;h=y1-y0+30
xy=lambda x,y:f'{x-x0+10:.3f},{y1-y+10:.3f}'
s=f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}mm" height="{h}mm" viewBox="0 0 {w} {h}"><title>Виміряна третя пластина: перевірити друк 1:1</title><polygon points="'+ ' '.join(xy(x,y) for x,y in outline)+'" fill="none" stroke="black" stroke-width="0.2"/>'
for x,y in posts:
    cx,cy=xy(x,y).split(',');s+=f'<circle cx="{cx}" cy="{cy}" r="1.6" fill="none" stroke="black" stroke-width="0.2"/>'
s+=f'<path d="M10 {h-10}h50" stroke="black" stroke-width="0.2"/><text x="10" y="{h-3}" font-size="3">Контроль: 50 мм. Акрил 3 мм. Перевірити центри на виробі.</text></svg>'
(p/'third-plate-measured.svg').write_text(s)
print('Created measured template; print at 100% and verify the 50 mm line and actual hole overlay before fabrication.')
