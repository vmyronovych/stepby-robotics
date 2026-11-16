export const breadboardCircuit=(inserted=true)=>({version:1,components:[
 {id:'esp',kind:'esp32',name:'ESP32',x:30,y:30},
 {id:'usb',kind:'usb',name:'USB',x:30,y:650},
 {id:'bb',kind:'breadboard',name:'Mini breadboard',x:400,y:200},
 {id:'r',kind:'resistor',name:'Резистор',resistance:330,x:440,y:30,rotation:90,...(inserted?{breadboardMount:{boardId:'bb',holes:{A:'E5',B:'F5'}}}:{})},
 {id:'led',kind:'led',name:'LED',ledColor:'green',x:680,y:30,...(inserted?{breadboardMount:{boardId:'bb',holes:{A:'J5',K:'J6'}}}:{})},
],wires:[['usb:USB','esp:USB'],['esp:right-11','bb:A5'],['bb:F6','esp:left-13']].map(([a,b],i)=>({id:`w${i}`,a,b,color:'#328f83'})),checked:[]});
