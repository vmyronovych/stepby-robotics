export const fixture=()=>({version:1,components:[
 {id:'esp',kind:'esp32',name:'ESP32',x:60,y:50},
 {id:'drv',kind:'driver',name:'Драйвер',x:460,y:60},
 {id:'motor',kind:'motor',name:'Лівий мотор',x:900,y:100},
 {id:'battery',kind:'battery',name:'Батареї',x:470,y:480},
 {id:'usb',kind:'usb',name:'Комп’ютер',x:60,y:720},
],wires:[['usb:USB','esp:USB'],['battery:PLUS','drv:VCC'],['battery:GND','drv:GND'],['esp:left-13','drv:GND'],['esp:right-11','drv:IN1'],['esp:right-10','drv:IN2'],['drv:OUT1','motor:A'],['drv:OUT2','motor:B']].map(([a,b],i)=>({id:'wire'+i,a,b,color:'#328f83'})),checked:[]});
export const wired=(ref,action='write')=>({type:'wired_pin_'+action,extraState:{ref},...(action==='write'?{fields:{STATE:'ON'}}:action==='pwm'?{inputs:{DUTY:{shadow:{type:'math_number',fields:{NUM:180}}}}}:{})});
export const program=(wiring=fixture())=>({wiring,blocks:{languageVersion:0,blocks:[{type:'usb_start',next:{block:wired('drv:IN1','pwm')}}]}});
