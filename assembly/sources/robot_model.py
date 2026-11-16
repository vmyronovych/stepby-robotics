"""Common simplified surface geometry for print and interactive assembly guides.
Coordinates are illustrative until the real chassis is measured, never a drill template.
Standard-library only so the browser export needs no PDF dependencies.
"""
from pathlib import Path
import json, math
from chassis_geometry import TRACE, MESH, BATTERY, THICKNESS, GAP, plate_faces
ROOT=Path(__file__).resolve().parents[2]
G=json.loads((Path(__file__).parent/'geometry.json').read_text())
# Preserve the old parameters as historical data. Only unmeasured components
# use schematic dimensions; the plates and battery come from the review data.
P={**G['illustrative'], **G['assembly_display'],
   'plate_length':TRACE['length_mm'], 'plate_width':TRACE['width_mm'],
   'plate_thickness':THICKNESS, 'clear_gap':GAP, 'lower_bottom_z':0,
   'battery_size_xyz':[BATTERY['width_mm'],BATTERY['length_mm'],BATTERY['height_with_cells_mm']]}
class Part:
    def __init__(self,id,stage,color,faces):self.id=id;self.stage=stage;self.color=color;self.faces=faces
parts=[]
def box(id,stage,center,size,color):
    x,y,z=center;a,b,h=[k/2 for k in size]
    v=[(x+i*a,y+j*b,z+k*h) for k in (-1,1) for j in (-1,1) for i in (-1,1)]
    f=[[v[i] for i in q] for q in [(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]]
    parts.append(Part(id,stage,color,f))
def cylinder(id,stage,center,radius,length,color,axis='z',n=20):
    rings=[]
    for sign in (-1,1):
        ring=[]
        for i in range(n):
            a=i*2*math.pi/n;v=[radius*math.cos(a),radius*math.sin(a),sign*length/2]
            if axis=='x':v=[v[2],v[0],v[1]]
            ring.append(tuple(v[k]+center[k] for k in range(3)))
        rings.append(ring)
    f=[rings[0][::-1],rings[1]]
    for i in range(n):f.append([rings[0][i],rings[0][(i+1)%n],rings[1][(i+1)%n],rings[1][i]])
    parts.append(Part(id,stage,color,f))
def plate(id,stage,z):
    parts.append(Part(id,stage,'#C7AE6F',plate_faces(z)))
LZ=P['lower_bottom_z'];LT=LZ+P['plate_thickness'];UZ=LT+P['clear_gap'];UT=UZ+P['plate_thickness'];CZ=UT+P['expansion_post_height']
plate('lower',1,LZ)
for idx,(x,y,z) in enumerate(P['axle_centres_xyz']):
    st=2 if idx==0 else 3;s=-1 if x<0 else 1
    box('motor'+str(idx),st,(s*38,y,LT+12.5),P['motor_size_xyz'],'#EDBD2D')
    box('motorcan'+str(idx),st,(s*38,y-15,LT+12.5),(22,26,18),'#AFB6BF')
    cylinder('shaft'+str(idx),st,(s*58,y,z),2.2,24,'#F1E8CD','x')
    # Generic retainers only: actual kit fastener locations unverified, never a drill template.
    for q in (-1,1):
        box('retainer'+str(idx)+str(q),st,(s*38,y+q*21,LT+2),(24,5,4),'#D4DEE6')
    cylinder('wheel'+str(idx),4,(x,y,z),P['wheel_diameter']/2,P['wheel_width'],'#394354','x',32)
    cylinder('hub'+str(idx),4,(x+s*13.4,y,z),19,1.5,'#F2C33A','x',24)
    cylinder('hubcap'+str(idx),4,(x+s*14.5,y,z),5,2,'#BDC5CD','x')
for i,(x,y) in enumerate(P['post_centres_xy']):
    cylinder('post'+str(i),5,(x,y,LT+P['clear_gap']/2),3.1,P['clear_gap'],'#A8B0BC',n=6)
    cylinder('postbolt'+str(i),5,(x,y,LZ-1),3,2,'#8B98AB')
# Measured envelope only: no invented holder walls, screws, straps or tape thickness.
BW,BL,BH=P['battery_size_xyz']
BX,BY=BATTERY['display_pose']['centre_xy_mm']; BT=BATTERY['display_pose']['top_z_mm']
box('batteryEnvelope',6,(BX,BY,BT-BH/2),(BW,BL,BH),'#236EB4')
# Sensor bracket is a single consistent Z shape; exact attachment holes are TBD.
SY_FRONT=P['sensor_centre_y']; SZ=P['sensor_optical_face_z']
box('bracketTop',7,(0,SY_FRONT-23.5,LT+1.5),(45,25,3),'#D77936')
box('bracketWall',7,(0,SY_FRONT-11,(LT+3+SZ+3.5)/2),(45,3,LT+3-SZ-3.5),'#D77936')
box('bracketFoot',7,(0,SY_FRONT+1.5,SZ+5),(45,25,3),'#D77936')
box('sensor',8,(0,SY_FRONT,SZ+2.25),(37,20,2.5),'#273E7A')
for x in (-16,-8,0,8,16):box('optics',8,(x,SY_FRONT,SZ+.5),(4,5,1),'#252B37')
# Non-occluding side clips: teacher-fabricated bracket feature, not invented PCB holes.
for x in (-20,20):box('sensorclip',8,(x,SY_FRONT,SZ+2.5),(3,20,6),'#DC854B')
plate('upper',9,UZ)
for i,(x,y) in enumerate(P['post_centres_xy']):
    cylinder('upperthumb'+str(i),9,(x,y,UT+2),4.5,4,'#41749D',n=16)
# Purchased 30P expansion board. Only its 51 x 66 mm envelope is seller-sourced.
# Socket spacing, PCB thickness, holes and chassis positions remain illustrative.
EX,EY=P['expansion_centre_xy']; EW,EL,ET=P['expansion_size_xyz']
for x,y in P['expansion_mount_centres_xy']:
    cylinder('expansionpost',10,(x,y,UT+5),2.3,10,'#E7E4DC',n=6)
    cylinder('expansionboltLower',10,(x,y,UT-1),2.5,2,'#B9BFC3')
box('expansion',10,(EX,EY,CZ+ET/2),(EW,EL,ET),'#283436')
for x,y in P['expansion_mount_centres_xy']:
    cylinder('expansionscrew',10,(x,y,CZ+ET+1),2.5,2,'#B9BFC3')
# Two 15-way female sockets and three rows of peripheral pins at each side.
pitch=2.54; SY=-10; row=P['esp_socket_spacing']/2
for side in (-1,1):
    sx=EX+side*row
    box('espsocket',10,(sx,SY,CZ+5.6),(2.6,39,8),'#30383E')
    for i in range(15):
        yy=SY+(i-7)*pitch
        box('socketOpening',10,(sx,yy,CZ+9.65),(1.5,1.5,.1),'#11171B')
        for r in range(3):
            xx=EX+side*(16+r*pitch)
            box('expansionHeaderBase',10,(xx,yy,CZ+2.6),(2.3,2.3,2),'#252F32')
            box('expansionPin',10,(xx,yy,CZ+6),(.65,.65,5),'#CEB579')
box('expansionDC',10,(EX-15,EY-27,CZ+7),(9,14,10),'#20292C')
box('expansionDCopening',10,(EX-15,EY-34.1,CZ+7),(6,.2,6),'#0A0F13')
box('expansionMicroUSB',10,(EX-1,EY-29,CZ+3.3),(8,6,3.4),'#BEC8D1')
box('expansionTypeC',10,(EX+17,EY-29,CZ+3.3),(9,7,3.4),'#BEC8D1')
box('expansionRegulator',10,(EX-8,EY-22,CZ+3.2),(6,5,3),'#465054')
for x in (EX-11,EX-3):cylinder('expansionCap',10,(x,EY-21,CZ+5),3,6,'#B7C4CA')
box('voltageJumper',10,(EX+11,EY-25,CZ+4),(3,5,4),'#EEC338')
# USB ends at rear (negative y); the antenna faces the front of the robot.
BZ=CZ+10.6
box('esp',11,(EX,SY,BZ),P['esp_size_xyz'],'#263F38')
box('espShield',11,(EX,SY+6,BZ+3.3),(18,22,5),'#BEC8D1')
box('antenna',11,(EX,SY+22,BZ+1.3),(18,8,1),'#252C2B')
box('usb',11,(EX,SY-26,BZ+2.5),(8,6,4),'#CFD5D8')
box('espUART',11,(EX,SY-15,BZ+2),(6,6,2.5),'#20292C')
for x in (EX-9,EX+9):box('espButton',11,(x,SY-20,BZ+2),(4,4,2.5),'#E1E1D9')
# Separate insulated teacher-prepared mounts: these are NOT expansion-board sockets.
DZ=UT+12
for j,x in enumerate((-22,20)):
    box('driverMount'+str(j),12,(x,47,UT+3),(30,29,6),'#E7E4DC')
    box('driversocket',12,(x,47,UT+8),(14,21,4),'#424C58')
    box('driver'+str(j),12,(x,47,DZ),(12.7,20.3,1.6),'#305FAB')
    box('driverchip'+str(j),12,(x,47,DZ+2.5),(7,7,3),'#303B4B')
    cylinder('drivercap'+str(j),12,(x+10,47,UT+11),4,12,'#2C4753')
RZ=UT+8
box('regMount',13,(40,-10,UT+3),(29,29,6),'#E7E4DC')
box('regulator',13,(40,-10,RZ+4),(22.9,22.9,9.7),'#237952')
box('inductor',13,(40,-10,RZ+10),(12,12,4),'#444C59')
box('switchMount',13,(45,-46,UT+3),(21,26,6),'#E7E4DC')
box('switch',13,(45,-46,UT+11),(13,19,10),'#C6464D')
box('buttonMount',13,(47,19,UT+3),(19,19,6),'#E7E4DC')
box('button',13,(47,19,UT+11),(13,13,10),'#E5AE25')
for i,x in enumerate((-21,-7,7,21)):
    # AA axes along y; cylinder helper supports x/z, transform after construction.
    cylinder('cell'+str(i),18,(0,0,0),6.8,50,'#46AAAD',axis='x')
    part=parts[-1];part.faces=[[ (BX+x+v[1],BY+v[0],BT-BH/2+v[2]) for v in f] for f in part.faces]


def wire_paths(stage, lift=0):
    paths=[]
    if stage>=14:
        for x,y in [(-38,55),(38,55),(-38,-55),(38,-55)]:
            dx=-22 if y>0 else 20
            paths.append(dict(stage=14,points=[(x,y,LT+20),(x*.6,y,UZ+7+lift),(dx,47,DZ+5+lift)],color='#D8892B',name='Моторний джгут'))
    if stage>=15:paths.append(dict(stage=15,points=[(EX+21,0,CZ+8+lift),(5,31,UT+17+lift),(-22,47,DZ+5+lift),(20,47,DZ+5+lift)],color='#1967BD',name='Команди драйверів'))
    if stage>=16:paths.append(dict(stage=16,points=[(0,SY_FRONT,SZ+3),(-25,SY_FRONT-15,LT+8),(-44,68,UZ+7+lift),(EX-21,0,CZ+8+lift)],color='#8B54AD',name='Джгут датчика JS'))
    if stage>=17:
        paths.append(dict(stage=17,points=[(BX+BW/2,BY,BT-BH/2),(76,0,LT+4),(76,0,UZ+7+lift),(45,-46,UT+16+lift),(40,-10,RZ+10+lift)],color='#C4484C',name='Живлення U2 через захист і S1'))
        paths.append(dict(stage=17,points=[(40,-10,RZ+10+lift),(20,-36,UT+16+lift),(EX-1,EY-29,CZ+4+lift)],color='#C4484C',name='Стабілізовані 5 В через J5 і Micro-USB плати розширення'))
        paths.append(dict(stage=17,points=[(45,-46,UT+16+lift),(59,31,UT+10+lift),(20,47,DZ+5+lift),(-22,47,DZ+5+lift)],color='#C4484C',name='Окрема моторна гілка після захисту'))
    return paths
