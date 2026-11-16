#!/usr/bin/env python3
"""Reproducible A4 manual. All assembly views use the same parameterized surface model.
Reviewed photo-traced chassis with schematic component placement; not manufacturing CAD.
Requirements: reportlab. Run from any directory; output paths are relative to repository root.
"""
from pathlib import Path
import json, math, html, base64
import numpy as np
from PIL import Image
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, Color
ROOT=Path(__file__).resolve().parents[2]
G=json.loads((Path(__file__).parent/'geometry.json').read_text())
# The shared model resolves measured envelopes, photo trace and schematic mounts.
OUT=ROOT/'assembly'; REND=OUT/'renders'; REND.mkdir(exist_ok=True)
for name,file in [('UA','Arial.ttf'),('UAB','Arial Bold.ttf')]:
    path=Path('/System/Library/Fonts/Supplemental')/file
    if not path.exists():
        import os
        path=Path(os.environ.get('MCAR_FONT_DIR','/usr/share/fonts/truetype/dejavu'))/('DejaVuSans-Bold.ttf' if name=='UAB' else 'DejaVuSans.ttf')
    pdfmetrics.registerFont(TTFont(name,str(path)))
W,H=595.2756,841.8898
NAVY='#142D49'; BLUE='#1967BD'; ORANGE='#EE8B24'; GRAY='#DDE4E9'; GREEN='#278C71'
def rgb(c):return tuple(int(c[i:i+2],16)/255 for i in (1,3,5))
def tint(c,f):
    r=rgb(c);return Color(*(min(1,x*f) for x in r))
def poly(c,pts,color,stroke='#647587',width=.5):
    c.setFillColor(HexColor(color) if isinstance(color,str) else color);c.setStrokeColor(HexColor(stroke));c.setLineWidth(width)
    p=c.beginPath();p.moveTo(*pts[0]);[p.lineTo(*v) for v in pts[1:]];p.close();c.drawPath(p,fill=1,stroke=1)
def text(c,x,y,s,size=14,bold=False,color=NAVY):
    c.setFillColor(HexColor(color));c.setFont('UAB' if bold else 'UA',size);c.drawString(x,y,s)
def wrap(c,s,x,y,width,size=16,leading=23,bold=False,color=NAVY):
    words=s.split();line='';lines=[]
    for word in words:
        trial=(line+' '+word).strip()
        if pdfmetrics.stringWidth(trial,'UAB' if bold else 'UA',size)>width:
            lines.append(line);line=word
        else:line=trial
    if line:lines.append(line)
    for line in lines:text(c,x,y,line,size,bold,color);y-=leading
    return y
# Isometric orthographic projection; same camera on every assembly page.
def project(v):
    x,y,z=v;return (.82*x-.57*y, -.32*x-.46*y+.90*z)
def depth(v):return .55*v[0]+.79*v[1]+.60*v[2]
from robot_model import parts, P, LZ, LT, UZ, UT, CZ, BZ, wire_paths

COLORS={'motor':'#E9B92F','wheel':'#394354','post':'#ABB5C1','battery':'#465365','bracket':'#D77936','sensor':'#273E7A','upper':'#BBD4E5','expansion':'#283436','esp':'#316A61','driver':'#305FAB','regulator':'#237952','cell':'#46AAAD'}
def scene(c,stage,newstage=None,rect=(45,280,505,340),lift=0,allcolor=False,svgpath=None,selection=None,view=None):
    # Battery stages look from below; all coordinates still belong to one model.
    transform = (lambda v: (v[0], -v[1], -v[2])) if view == 'bottom' else (lambda v: v)
    project_view = lambda v: project(transform(v))
    depth_view = lambda v: depth(transform(v))
    x0,y0,ww,hh=rect
    chosen=[p for p in parts if selection is None or p.id in selection]
    reference=[(x,y,z+(lift if 9<=p.stage<=13 else 0)) for p in chosen for f in p.faces for x,y,z in f]
    pp=[project_view(v) for v in reference]
    xmin,xmax=min(v[0] for v in pp),max(v[0] for v in pp)
    ymin,ymax=min(v[1] for v in pp),max(v[1] for v in pp)
    scale=min((ww-16)/(xmax-xmin),(hh-16)/(ymax-ymin))
    ox=x0+(ww-scale*(xmin+xmax))/2;oy=y0+(hh-scale*(ymin+ymax))/2
    faces=[];svg=[]
    def conv(v):a,b=project_view(v);return(ox+scale*a,oy+scale*b)
    for part in chosen:
        if part.stage>stage:continue
        if part.id=='batteryEnvelope' and stage>=18:continue
        zoff=lift if 9<=part.stage<=13 else 0
        for fi,face in enumerate(part.faces):
            f=[(x,y,z+zoff)for x,y,z in face]
            col=part.color if allcolor or part.stage==newstage else '#E2E7EB'
            # Subtle deterministic face shading; visible top faces are brightest.
            normal=np.cross(np.subtract(f[1],f[0]),np.subtract(f[2],f[0])); length=np.linalg.norm(normal)
            shade=.8+.2*abs(normal[2]/length) if length else .85
            faces.append((sum(depth_view(v)for v in f)/len(f),f,tint(col,shade),parts.index(part)*10+round(shade*5)))
    # Depth-buffered orthographic rasterization avoids painter-order errors for large plates.
    # Every pixel still comes from the same mechanical surfaces; no generative artwork.
    factor=3; iw,ih=round(ww*factor),round(hh*factor)
    pixels=np.full((ih,iw,3),255,dtype=np.uint8)
    zbuf=np.full((ih,iw),-1e9,dtype=np.float32)
    labels=np.full((ih,iw),-1,dtype=np.int32)
    for _,face,col,surface_id in faces:
        vertices=[]
        for v in face:
            sx,sy=conv(v);vertices.append(((sx-x0)*factor,(hh-(sy-y0))*factor,depth_view(v)))
        # Convex plate outline and all primitive faces can be triangulated as a fan.
        for j in range(1,len(vertices)-1):
            a,b,d=np.array([vertices[0],vertices[j],vertices[j+1]])
            xmin=max(0,int(min(a[0],b[0],d[0])));xmax=min(iw-1,int(max(a[0],b[0],d[0]))+1)
            ymin=max(0,int(min(a[1],b[1],d[1])));ymax=min(ih-1,int(max(a[1],b[1],d[1]))+1)
            if xmin>xmax or ymin>ymax:continue
            denom=(b[1]-d[1])*(a[0]-d[0])+(d[0]-b[0])*(a[1]-d[1])
            if abs(denom)<.001:continue
            yy,xx=np.mgrid[ymin:ymax+1,xmin:xmax+1]
            u=((b[1]-d[1])*(xx-d[0])+(d[0]-b[0])*(yy-d[1]))/denom
            v=((d[1]-a[1])*(xx-d[0])+(a[0]-d[0])*(yy-d[1]))/denom
            w=1-u-v;zz=u*a[2]+v*b[2]+w*d[2]
            region=zbuf[ymin:ymax+1,xmin:xmax+1]
            mask=(u>=-.001)&(v>=-.001)&(w>=-.001)&(zz>region)
            region[mask]=zz[mask]
            pixels[ymin:ymax+1,xmin:xmax+1][mask]=[round(col.red*255),round(col.green*255),round(col.blue*255)]
            labels[ymin:ymax+1,xmin:xmax+1][mask]=surface_id
    # A fine contour helps acrylic and already-installed parts remain readable in print.
    edge=np.zeros((ih,iw),dtype=bool)
    edge[:,1:]|=(labels[:,1:]!=labels[:,:-1]) & (labels[:,1:]>=0)
    edge[1:,:]|=(labels[1:,:]!=labels[:-1,:]) & (labels[1:,:]>=0)
    pixels[edge]=(pixels[edge].astype(float)*.76).astype(np.uint8)
    picture=Image.fromarray(pixels)
    c.drawImage(ImageReader(picture),x0,y0,width=ww,height=hh)
    if stage>=18 and (selection is None or 'batteryEnvelope' in selection):
        # Envelope edges remain visible around the illustrative AA cells.
        from PIL import ImageDraw
        draw=ImageDraw.Draw(picture)
        envelope=next(p for p in parts if p.id=='batteryEnvelope')
        for face in envelope.faces:
            points=[((conv(v)[0]-x0)*factor,(hh-(conv(v)[1]-y0))*factor) for v in face]
            draw.line(points+[points[0]],fill='#236EB4',width=2)
        c.drawImage(ImageReader(picture),x0,y0,width=ww,height=hh)
    if svgpath:
        pngpath=svgpath.with_suffix('.png');picture.save(pngpath)
        payload=base64.b64encode(pngpath.read_bytes()).decode()
        svg.append(f'<image x="{x0}" y="{H-y0-hh}" width="{ww}" height="{hh}" href="data:image/png;base64,{payload}"/>')
    # Stable simplified harness paths; labels/connectors defined by wiring.md, not these routing sketches.
    paths=[(p['points'],p['color']) for p in wire_paths(stage,lift)] if selection is None else []
    if view=='bottom':paths=[(p['points'][:2],p['color']) for p in wire_paths(stage,lift) if p['name']=='Живлення U2 через захист і S1']
    for pts,col in paths:
        xy=[conv(v)for v in pts];c.setStrokeColor(HexColor(col));c.setLineWidth(2)
        p=c.beginPath();p.moveTo(*xy[0]);[p.lineTo(*v)for v in xy[1:]];c.drawPath(p)
        if svgpath:svg.append('<polyline points="'+' '.join(f'{x:.2f},{H-y:.2f}'for x,y in xy)+f'" fill="none" stroke="{col}" stroke-width="2"/>')
    if svgpath:
        svgpath.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842"><title>Послідовна 3D модель: крок {stage}</title><rect width="595" height="842" fill="white"/>'+''.join(svg)+'</svg>')
    return conv

def arrow(c,a,b,label=None):
    c.setStrokeColor(HexColor(ORANGE));c.setLineWidth(3);c.line(*a,*b)
    dx,dy=b[0]-a[0],b[1]-a[1];d=max(.001,math.hypot(dx,dy));u,v=dx/d,dy/d
    poly(c,[b,(b[0]-12*u+5*v,b[1]-12*v-5*u),(b[0]-12*u-5*v,b[1]-12*v+5*u)],ORANGE,ORANGE)
    if label:text(c,a[0]+7,a[1]+4,label,12,True)
def card(c,label,body,y=130):
    c.setFillColor(HexColor('#EFF4F8'));c.roundRect(35,y,525,88,12,fill=1,stroke=0)
    text(c,51,y+63,label,12,True,BLUE);wrap(c,body,51,y+39,493,16,21)
def header(c,n,title,subtitle='СКЛАДАЄМО РАЗОМ'):
    c.setFillColor(HexColor(BLUE));c.roundRect(35,H-82,51,47,10,fill=1,stroke=0);text(c,44,H-67,f'{n:02d}',24,True,'#FFFFFF')
    text(c,100,H-46,subtitle,10,True,BLUE);wrap(c,title,100,H-72,460,24,28,True)
def footer(c,n,total):
    text(c,35,31,'Мандрівник • Корпус за фото; посадки перевіряє вчитель',9,color='#617487')
    text(c,515,31,f'{n:02d} / {total:02d}',10,True)
def checklist(c,items,y=650):
    for s in items:
        c.setStrokeColor(HexColor(BLUE));c.setLineWidth(1.2);c.roundRect(40,y-3,15,15,3,stroke=1,fill=0)
        y=wrap(c,s,68,y,485,17,24)-23
    return y
from assembly_steps import PAGES

def draw_inventory(c,which):
    data=[('2','Акрилові пластини','Верхня й нижня','plate'),('4','Мотори з редукторами','Разом із кріпленнями','motor'),('4','Колеса','Підходять до комплектних валів','wheel'),('1','Відсік на 4 AA','Поки без елементів','battery'),('1','Набір кріплень','Розклади за розміром','post'),('1','Набір проводів','Оглядає вчитель','wire')] if which==0 else [('1','ESP32 DevKit V1','30 контактів (15 + 15)','esp'),('2','Драйвери D1 і D2','DRV8833 #2130: перед / зад','driver'),('1','Датчик лінії','QTR-MD-05A','sensor'),('1','Перетворювач 5 В','S13V30F5','regulator'),('4','Акумулятори AA','NiMH + спільний зарядний','cell'),('1','Плата розширення','ESP32 30P · код 101712','expansion')]
    for i,(qty,title,sub,kind) in enumerate(data):
        x=35+(i%2)*268;y=590-(i//2)*159
        c.setFillColor(HexColor('#F3F6F8'));c.roundRect(x,y,257,145,12,fill=1,stroke=0)
        col=COLORS.get(kind,BLUE)
        ids={'plate':['lower'],'motor':['motor0','motorcan0','shaft0'],'wheel':['wheel0','hub0','hubcap0'],'battery':['batteryEnvelope'],'post':['post0'],'esp':['esp','espShield','antenna','usb'],'driver':['driver0','driverchip0'],'sensor':['sensor','optics'],'regulator':['regulator','inductor'],'cell':['cell0'],'expansion':[p.id for p in parts if p.stage==10]}
        if kind in ids:scene(c,18,rect=(x+12,y+67,83,64),allcolor=True,selection=ids[kind],view='bottom' if kind=='battery' else None)
        else:
            c.setStrokeColor(HexColor(ORANGE));c.setLineWidth(3)
            c.bezier(x+25,y+80,x+90,y+80,x+25,y+120,x+80,y+120)
        text(c,x+93,y+86,qty+' шт.',25,True)
        text(c,x+16,y+43,title,15,True);wrap(c,sub,x+16,y+23,228,11,14)
    wrap(c,'Учитель також готує окремі тримачі D1/D2/U2, кронштейн, джгути, кріплення, кнопку, вимикач і захист живлення. Гнізда плати 30P вже припаяні.',40,210,510,16,23)

def build():
    path=OUT/'assembly-manual.pdf';c=canvas.Canvas(str(path),pagesize=(W,H));c.setTitle('Мандрівник: складання робота 4WD');c.setAuthor('Навчальний проєкт Мандрівник');c.setSubject('Український посібник. Попередня геометрія, потрібна перевірка першого зразка.')
    manifest=[]
    for n,p in enumerate(PAGES,1):
        kind=p['kind'];header(c,n,p['title'], 'РОБОТ 4WD • ESP32 • 8–10 РОКІВ' if kind=='cover' else 'СКЛАДАЄМО РАЗОМ')
        if kind=='cover':
            text(c,40,693,'Збирай. Досліджуй. Програмуй.',23,True)
            scene(c,18,rect=(35,290,525,370),allcolor=True,svgpath=REND/'completed.svg')
            card(c,'ДЛЯ ДВОХ ДОСЛІДНИКІВ','Один складає. Другий перевіряє. Потім міняємося ролями.',145)
            wrap(c,'Пілотний посібник. Перед уроком учитель звіряє шасі, кріплення і струми моторів.',40,110,510,14,21)
        elif kind=='teacher':
            checklist(c,['Цей примірник показує послідовність на спрощеній спільній 3D моделі. Пластини 255 × 150 × 3 мм, проміжок 30 мм; контур і 72 отвори оцінені за фото.','Звірте отвори, місця кріплення й остаточний зазор відсіку після скотчу. Приміряйте плату 30P, окремі тримачі й кронштейн. Малюнки не є шаблонами свердління.','До уроку дорослий паяє та ізолює проводку, установлює струмові шунти й перевіряє запобіжники.','Підтвердьте компіляцію прошивки ESP32 і пройдіть приймальні випробування з папки перевірок.','Перевірте 30 контактів ESP32, перемичку 3,3 В і джгути. Дайте дітям підписані роз’єми. Заряджає AA тільки дорослий.'],y=697)
            card(c,'УМОВА ПОЧАТКУ УРОКУ','Учитель сам зібрав і випробував цей робот за всіма кроками.',105)
        elif kind=='inventory':draw_inventory(c,p['which'])
        elif kind=='build':
            wrap(c,p['action'],40,707,510,18,25)
            conv=scene(c,p['stage'],p['new'],rect=(40,275,515,340 if not p['lift'] else 320),lift=p['lift'],svgpath=REND/f'step-{n:02d}.svg',view=p.get('view'))
            for a,b in p['arrows']:arrow(c,conv(a),conv(b))
            if p['stage']==12:
                for label,x in [('D1',-22),('D2',20)]:
                    sx,sy=conv((x,47,UT+28))
                    c.setFillColor(HexColor('#FFFFFF'));c.roundRect(sx-14,sy-5,28,21,4,fill=1,stroke=0)
                    text(c,sx-11,sy,label,12,True,BLUE)
            text(c,40,253,'Кольором показано нові деталі.',12,color=BLUE)
            if p['stage']==8:
                c.setFillColor(HexColor('#F1F5F8'));c.roundRect(380,563,169,80,8,fill=1,stroke=0)
                text(c,391,622,'Вид датчика знизу',11,True)
                c.setFillColor(HexColor('#273E7A'));c.rect(397,580,131,28,fill=1,stroke=0)
                for i in range(5):c.setFillColor(HexColor('#AAB6CB'));c.rect(404+25*i,587,15,14,fill=1,stroke=0)
            card(c,'ПОТРІБНО',p['need'],143)
            wrap(c,'Перевір: '+p['check'],40,115,510,15,22)
            manifest.append({'page':n,'stage':p['stage'],'new_stage':p['new'],'lift_mm':p['lift'],'title':p['title']})
        elif kind=='inspection':
            checklist(c,['S1 вимкнений. AA ще немає. USB комп’ютера від’єднаний.','Учитель звірив контакти S/V/G та перемичку 3,3 В. Живлення від U2 йде в Micro-USB плати 30P; круглий вхід вільний.','Гвинти тримають деталі. Акрил без тріщин.','Дроти закріплені та не дістають коліс. Голих контактів немає.','П’ять сенсорів дивляться вниз. Зазор до підлоги близько 5 мм.','Відсік закріплений під нижньою платформою. Доступ до AA знизу вільний.'],y=699)
            card(c,'ПЕРЕДАЙ УЧИТЕЛЮ','Перевірка напруг і першого запуску належить дорослому.',100)
        elif kind=='complete':
            scene(c,18,rect=(35,300,525,380),allcolor=True)
            card(c,'ЗНАЙДИ НА РОБОТІ','Чотири колеса, п’ять очей, мозок ESP32 і головний вимикач.',155)
            wrap(c,'Рух починаємо тільки після перевірки вчителем.',40,120,510,19,25)
        elif kind=='power':
            checklist(c,['Постав робот на стійку підставку. Усі чотири колеса вільні.','Учитель вмикає S1. Робот не повинен сам рушати.','На телефоні вибери Wi-Fi «Mandrivnyk-…». Пароль дає вчитель.','Відкрий у браузері http://192.168.4.1. Інтернет не потрібний.','Знайди велику кнопку «СТОП». Вимикач S1 завжди має бути доступний.'],y=697)
            card(c,'ЯКЩО ЩОСЬ НЕ ТАК','Вимкни S1. Поклич учителя. Не переставляй дроти під живленням.',110)
        elif kind=='test':
            scene(c,18,rect=(70,353,450,300),allcolor=True)
            wrap(c,'Колеса підняті. Відкрий «Перевірка коліс» разом з учителем.',40,707,510,19,25)
            card(c,'ЧОТИРИ КОРОТКІ ПЕРЕВІРКИ','Ліве переднє → праве переднє → ліве заднє → праве заднє.',220)
            wrap(c,'Кожна кнопка обертає лише назване колесо вперед. Якщо не збігається, вимкни живлення. Полярність виправляє вчитель.',40,180,510,18,25)
        elif kind in ('white','black'):
            dark=kind=='black'
            wrap(c,'Робот нерухомий. Усі п’ять очей над '+('широкою чорною поверхнею.' if dark else 'білим аркушем.'),40,707,510,20,28)
            c.setFillColor(HexColor('#232E3B' if dark else '#FFFFFF'));c.setStrokeColor(HexColor('#71849A'));c.roundRect(70,330,455,270,12,fill=1,stroke=1)
            c.setFillColor(HexColor('#284B86'));c.roundRect(120,430,355,85,7,fill=1,stroke=0)
            for i in range(5):c.setFillColor(HexColor('#AFBAD1'));c.rect(139+i*67,450,48,39,fill=1,stroke=0)
            text(c,125,389,'5 очей • зазор 5 мм',20,True,'#FFFFFF' if dark else NAVY)
            card(c,'ОЧІ РОБОТА','Натисни «Запам’ятати '+('чорне' if dark else 'біле')+'». Почекай одну секунду.',195)
            wrap(c,'Має з’явитися «Калібрування готове». Якщо ні, поклич учителя.' if dark else 'Тепер підготуй широку чорну поверхню для наступного кроку.',40,145,510,18,25)
        elif kind=='movement':
            wrap(c,'Постав робот на вільну підлогу. Склади три блоки у браузері.',40,707,510,20,28)
            for i,s in enumerate(['Швидкість   80','Вперед   2 секунди','Стоп']):
                y=545-i*87;c.setFillColor(HexColor(BLUE if i<2 else '#BB3948'));c.roundRect(80,y,435,66,12,fill=1,stroke=0);text(c,105,y+24,s,24,True,'#FFFFFF')
            card(c,'ЗАПУСК','«Зберегти в роботі» → «Запустити». Передбач, де зупиниться робот.',185)
            wrap(c,'Продовжуй досліди на восьми заняттях. Після калібрування спробуй чорну дорогу.',40,140,510,18,25)
        elif kind=='finish':
            checklist(c,['Натисни «СТОП».','Вимкни S1.','Знімай AA або відкривай верх лише після вимкнення. Заряджання виконує вчитель.','Не з’єднуй USB і зовнішні 5 В одночасно. Перед USB дорослий знімає AA й роз’єднує J5.','Поверни робот і деталі на свої місця. Запиши одне відкриття з уроку.'],y=697)
            card(c,'НАСТУПНА ІДЕЯ','Навчи робот повертати, змінювати швидкість і шукати лінію.',135)
        footer(c,n,len(PAGES));c.showPage()
    c.save();(OUT/'sources/page-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
    (OUT/'sources/model-manifest.json').write_text(json.dumps([dict(id=p.id,stage=p.stage,faces=len(p.faces))for p in parts],indent=2))
    obj=['# Illustrative only. NOT FOR MANUFACTURE. Units mm.'];offset=1
    for k,part in enumerate(parts):
        obj.append(f'o {part.id}_{k}_stage_{part.stage}')
        for face in part.faces:
            for x,y,z in face:obj.append(f'v {x:.5f} {y:.5f} {z:.5f}')
            obj.append('f '+' '.join(str(offset+i)for i in range(len(face))));offset+=len(face)
    (OUT/'sources/model-demo.obj').write_text('\n'.join(obj)+'\n')
    print(f'{path}: {len(PAGES)} A4 pages, {len(parts)} consistently positioned model parts')
if __name__=='__main__':build()
