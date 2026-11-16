export function usbDiagnostic({stage,message='',log='',port,now=new Date()}){
 let device='невідомий';try{const info=port?.getInfo();if(info?.usbVendorId)device=`VID ${info.usbVendorId.toString(16)} / PID ${info.usbProductId?.toString(16)||'?'}`;}catch{}
 const redact=text=>text.replace(/password=[^\s]+/gi,'password=[приховано]').replace(/Teacher PIN:[^\r\n]*/gi,'Teacher PIN: [приховано]');
 return redact(`Час: ${now.toISOString()}\nЕтап: ${stage}\nUSB: ${device}\n${message}`)+'\n'+redact(log).slice(-14000);
}
