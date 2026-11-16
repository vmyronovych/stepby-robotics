#pragma once
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <esp_system.h>
#include "remote_control.h"
#include "remote_page.h"
namespace remote {
WebServer server(80);
mcar::RemoteLease lease;
String name,password;
int held=0;
int responseCode=200;
String responseType,responseBody;
void respond(int code,const char* type,const String& body){responseCode=code;responseType=type;responseBody=body;}
void route(const char* path,HTTPMethod method,std::function<void()> handler){
 server.on(path,method,[handler]{
  {RuntimeGuard guard;handler();}
  server.send(responseCode,responseType,responseBody);
 });
}
const char* names[]={"Вперед","Назад","Ліворуч","Праворуч","Блимнути","Танець","Кнопка 1","Кнопка 2"};
void stop(){machine.reset();stopped=true;mcarStopPins();held=0;lease.clear();}
void changed(){stop();}
void connectionInfo(){Serial.printf("REMOTE_WIFI: %s password=%s http://192.168.4.1\n",name.c_str(),password.c_str());}
void configure(){
 if(usbvm::remoteProgram(program)){
  WiFi.mode(WIFI_AP);
  if(!WiFi.softAP(name.c_str(),password.c_str()))Serial.println("REMOTE_ERROR: Wi-Fi failed");
  connectionInfo();
 }else WiFi.mode(WIFI_OFF);
}
bool number(const String& text,uint32_t& value){
 if(!text.length()||text.length()>10)return false;value=0;
 for(unsigned index=0;index<text.length();index++){char digit=text[index];if(digit<'0'||digit>'9'||value>(UINT32_MAX-(digit-'0'))/10)return false;value=value*10+(digit-'0');}return true;
}
bool authorized(){
 uint32_t token,sequence;
 if(!number(server.arg("token"),token)||!number(server.arg("seq"),sequence)||!lease.accept(token,sequence,millis())){respond(409,"text/plain; charset=utf-8","Пульт неактивний або команда застаріла");return false;}return true;
}
void setup(){
 Preferences preferences;preferences.begin("remote",false);
 password=preferences.getString("password","");
 if(password.length()!=12){char generated[13];snprintf(generated,sizeof(generated),"%08lx%04lx",(unsigned long)esp_random(),(unsigned long)(esp_random()&0xffff));password=generated;preferences.putString("password",password);}preferences.end();
 char suffix[9];snprintf(suffix,sizeof(suffix),"%08lx",(unsigned long)(ESP.getEfuseMac()&0xffffffff));name=String("Mandrivnyk-")+suffix;
 WiFi.mode(WIFI_AP);
 if(!WiFi.softAP(name.c_str(),password.c_str())){Serial.println("REMOTE_ERROR: Wi-Fi failed");return;}
 configure();
 const char* headers[]={"Origin"};server.collectHeaders(headers,1);
 server.on("/",HTTP_GET,[]{server.sendHeader("Cache-Control","no-store");server.send_P(200,"text/html; charset=utf-8",REMOTE_PAGE);});
 route("/remote/info",HTTP_GET,[]{
  String body="{\"name\":\""+name+"\",\"commands\":[";bool comma=false;
  for(int command=1;command<=8;command++)if(usbvm::eventEntry(program,command)>=0){if(comma)body+=",";comma=true;body+="{\"id\":"+String(command)+",\"name\":\""+names[command-1]+"\",\"hold\":"+(usbvm::eventEntry(program,command+8)>=0?"true":"false")+"}";}
  server.sendHeader("Cache-Control","no-store");respond(200,"application/json",body+"]}");
 });
 route("/remote/claim",HTTP_POST,[]{
  if(server.header("Origin")!="http://192.168.4.1"){respond(403,"text/plain","Open http://192.168.4.1");return;}
  if(!usbvm::remoteProgram(program)){respond(409,"text/plain; charset=utf-8","Спочатку завантаж команди пульта");return;}
  uint32_t token=esp_random();if(!token)token=1;
  if(!lease.claim(token,millis())){respond(409,"text/plain; charset=utf-8","Машинкою вже керує інший пульт");return;}
  respond(200,"text/plain",String(token));
 });
 route("/remote/heartbeat",HTTP_POST,[]{if(!authorized())return;uint32_t expected;if(!number(server.arg("held"),expected)||expected>8||expected!=(uint32_t)held){stop();respond(409,"text/plain","Hold lost");return;}respond(200,"text/plain","OK");});
 route("/remote/stop",HTTP_POST,[]{if(!authorized())return;stop();respond(200,"text/plain","STOPPED");});
 route("/remote/event",HTTP_POST,[]{
  if(!authorized())return;uint32_t event;
  if(!number(server.arg("event"),event)||event<1||event>16||usbvm::eventEntry(program,event)<0){respond(400,"text/plain","Unknown command");return;}
  if(event>8){if(held!=(int)event-8){respond(409,"text/plain","Not held");return;}machine.stop();mcarStopPins();held=0;}
  else if(machine.busy()||held){respond(409,"text/plain; charset=utf-8","Дочекайся завершення команди");return;}
  if(!machine.startEvent(program,event)){stop();respond(400,"text/plain","Invalid handler");return;}
  if(event<=8&&usbvm::eventEntry(program,event+8)>=0)held=event;
  stopped=false;respond(200,"text/plain","OK");
 });
 server.begin();
 if(xTaskCreate([](void*){for(;;){server.handleClient();delay(1);}},"remote-http",16384,nullptr,1,nullptr)!=pdPASS){server.stop();stop();Serial.println("REMOTE_ERROR: task failed");}
}
void tick(){if(lease.expired(millis()))stop();}
}
