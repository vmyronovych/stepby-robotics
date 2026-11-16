"""Extrude the reviewed photo trace, retaining every opening in both plates.

The origin and source data are identical to chassis-review-3d.js: the underside
of the lower plate is z=0. The photo trace is not manufacturing CAD.
"""
import json
from pathlib import Path

SOURCE = Path(__file__).parent
TRACE = json.loads((SOURCE / 'chassis-photo-trace.json').read_text())
MESH = json.loads((SOURCE / 'chassis-planar-mesh.json').read_text())
BATTERY = json.loads((SOURCE / 'battery-measurements.json').read_text())
THICKNESS = MESH['thickness_mm']
GAP = MESH['clear_gap_mm']
assert THICKNESS == TRACE['thickness_mm'] > 0
assert GAP == TRACE['clear_gap_mm'] > 0
assert MESH['openingCount'] == len(TRACE['features'])


def plate_faces(z):
    faces = []
    for indices in MESH['triangles']:
        triangle = [MESH['vertices_xy'][i] for i in indices]
        a, b, c = triangle
        if (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]) < 0:
            triangle.reverse()
        faces.append([(x, y, z+THICKNESS) for x, y in triangle])
        faces.append([(x, y, z) for x, y in reversed(triangle)])
    loops = [TRACE['outline']['polygon_xy']] + [f['polygon_xy'] for f in TRACE['features']]
    for index, original in enumerate(loops):
        loop = list(original)
        area = sum(a[0]*b[1]-b[0]*a[1] for a, b in zip(loop, loop[1:]+loop[:1]))
        # Material lies on the left: outer boundary CCW, openings CW.
        if (area < 0) != (index > 0):
            loop.reverse()
        for a, b in zip(loop, loop[1:]+loop[:1]):
            faces.append([(a[0],a[1],z), (b[0],b[1],z),
                          (b[0],b[1],z+THICKNESS), (a[0],a[1],z+THICKNESS)])
    return faces
