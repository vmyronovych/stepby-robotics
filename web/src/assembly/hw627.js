// Reference: user-supplied Uamper screenshots, assembly/references/drv8833-hw627/.
// Owner specifies a 7 × 2.54 mm row spacing; body dimensions remain photo estimates. The pin diagram shows the
// solder side. With the LED end kept at the top, the component side is mirrored.
export const HW627={
 name:'HW-627',chip:'DRV8833',width:20.68,height:18.5,thickness:.75,
 dimensionStatus:'PIN_ROW_SPACING_OWNER_CONFIRMED_BODY_ESTIMATED',pinPitch:2.54,rowPitchCount:7,
 componentSideLeft:['SLEEP','OUT1','OUT2','OUT3','OUT4','FAULT'],
 componentSideRight:['IN4','IN3','GND','VCC','IN2','IN1'],
 source:'User screenshots of Uamper article 11309; product_id=1309',
};
export const HW627_PINS=[...HW627.componentSideLeft.map((name,row)=>({name,x:-HW627.rowPitchCount*HW627.pinPitch/2,y:6.35-row*2.54,side:'left',row})),...HW627.componentSideRight.map((name,row)=>({name,x:HW627.rowPitchCount*HW627.pinPitch/2,y:6.35-row*2.54,side:'right',row}))];
export function hw627Pins(id,gpios,fault,motors){
 const front=id==='D1',harness=front?'JD1':'JD2';
 return HW627_PINS.map(p=>{
  const common={...p,group:'Керування',note:'Підключення до ESP32 запропоновано для наявної конфігурації прошивки; перевірити на реальній платі.'};
  if(p.name.startsWith('IN')){const n=+p.name.slice(2),left=n<=2;return {...common,color:'#398dcc',icon:'brain',direction:'in',role:'Команда від мозку',short:'Передає команду від контролера до драйвера.',destination:'ESP32',target:'ESP32',connection:`ESP32 GPIO${gpios[n-1]} · ${harness}.${n+1}`};}
  if(p.name.startsWith('OUT')){const n=+p.name.slice(3),left=n<=2,motor=motors[left?0:1];return {...common,group:'Мотори',color:left?'#2ea88a':'#9570cf',icon:'motor',role:'До колеса',short:'Два проводи разом обертають один мотор.',destination:`${left?'Лівий':'Правий'} ${front?'передній':'задній'} мотор`,target:`M${(front?0:2)+(left?1:2)}`,connection:`${motor}.${(n-1)%2+1}`,pair:left?['OUT1','OUT2']:['OUT3','OUT4']};}
  if(p.name==='VCC')return {...common,group:'Живлення',color:'#e69735',icon:'battery',direction:'in',role:'Енергія для моторів',short:'Сюди приходить «плюс» від батарей.',destination:'Батареї +',target:'BT1',connection:'VBAT_SW після F1, S1 та D0',note:'VCC на цьому модулі — живлення моторів 2,7–10,8 В за схемою продавця, не живлення логіки 3V3. Перевірити полярність і захист конкретної плати.'};
  if(p.name==='GND')return {...common,group:'Живлення',color:'#64777c',icon:'ground',direction:'none',role:'Спільний «мінус»',short:'З’єднує землю батарей, драйвера й ESP32.',destination:'Спільна земля',target:'BT1',connection:`GND-зірка · ${harness}.1`,note:'Силовий та сигнальний зворотні проводи мають спільну землю.'};
  if(p.name==='SLEEP')return {...common,color:'#9b81ce',icon:'moon',direction:'in',role:'Сон або робота',short:'Контакт керування режимом сну.',destination:'Підключення не підтверджено',connection:'Зв’язок SLEEP із J1 на цьому модулі не підтверджений.',note:'У моделі позначено контакт SLEEP і майданчики J1. Їхній фактичний зв’язок на вашій версії HW-627 не встановлено; конструктор не перевіряє стан J1.'};
  return {...common,color:'#d86665',icon:'alert',role:'Сигнал «щось не так»',short:'Попереджає мозок про несправність.',destination:'ESP32',target:'ESP32',connection:`ESP32 GPIO${fault} · ${harness}.6`,note:'На схемі продавця напис частково видно як ULT; стрілка позначає вихід несправності з активним низьким рівнем. Проєктне підтягування: 10 кΩ до 3V3; перевірити вихід і напругу на модулі.'};
 });
}
