#pragma once
// Included after motor/safety functions. Network handlers never drive GPIO directly.
#include <Update.h>
#include <esp_ota_ops.h>
#include <esp_system.h>
#include <memory>
#include "workshop_assets.h"
namespace workshop {
String deviceName,deviceId,pin,token;
uint32_t otaPreparedAt=0,otaUnlockedAt=0,rebootAt=0,lastPinAt=0;
bool otaUnlocked=false,otaWriting=false,otaAccepted=false,otaFailed=false,rebootPending=false,otaFileSeen=false,otaStreamComplete=false;
size_t otaExpected=0,otaReceived=0;
unsigned pinFailures=0;
uint32_t hash(const String& s){uint32_t h=2166136261u;for(size_t i=0;i<s.length();i++)h=(h^(uint8_t)s[i])*16777619u;return h;}
String hexHash(uint32_t h){char out[9];snprintf(out,sizeof(out),"%08lx",(unsigned long)h);return String(out);}
bool tokenValid(){return token.length()==32 && server.header("X-OTA-Token")==token;}
void forceStop(const char* reason){Guard g;stop(reason);for(int i=0;i<4;i++){slew[i].update(0,millis(),true);writeMotor(i,0);}}
void leaveMaintenance(){if(otaWriting)Update.abort();otaWriting=false;otaUnlocked=false;token="";Guard g;state.maintenance=false;stop("Оновлення закрито");}
void registerRoutes(const char* ssid){
  deviceName=ssid;deviceId=String(ssid).substring(11); // identity also includes fixed product family
  pin=prefs.getString("teacherPin","");
  if(pin.length()!=6){char p[7];snprintf(p,sizeof(p),"%06lu",(unsigned long)(esp_random()%1000000));pin=p; prefs.putString("teacherPin",pin);}
  Serial.printf("Teacher PIN: %s (OTA only; keep with teacher)\n",pin.c_str());
  const char* headers[]={"X-OTA-Token"};server.collectHeaders(headers,1);
  for(const auto& item:WEB_ASSETS){const WebAsset asset=item;server.on(asset.path,HTTP_GET,[asset]{server.sendHeader("Content-Encoding","gzip");server.sendHeader("Cache-Control","no-store");server.send_P(200,asset.mime,(const char*)asset.data,asset.length);});}
  server.on("/api/info",HTTP_GET,[]{
    const esp_partition_t* part=esp_ota_get_next_update_partition(nullptr);
    String json="{\"product\":\"mandrivnyk-4wd\",\"protocol\":2,\"firmware\":\"0.3.0\",\"id\":\""+deviceId+"\",\"name\":\""+deviceName+"\",\"otaMaxSize\":"+String(part?part->size:0)+"}";
    server.send(200,"application/json",json);
  });
  server.on("/api/program",HTTP_POST,[]{
    {Guard g;if(state.maintenance){reply(false,"Спочатку закрийте режим оновлення");return;}}
    String body=server.arg("plain");auto candidate=std::unique_ptr<blocks::Program>(new(std::nothrow) blocks::Program());
    if(!candidate || body.length()>4096 || strlen(body.c_str())!=body.length() || !blocks::parse(body.c_str(),*candidate)){reply(false,"Програма не пройшла перевірку");return;}
    forceStop("Збереження програми");
    if(prefs.putString("blocks",body)!=body.length()){reply(false,"Не вдалося записати пам’ять. Стару програму не замінено");return;}
    {Guard g;stop("Програму блоків збережено");blockProgram=*candidate;blockLoaded=true;blockHash=hash(body);state.preferBlocks=true;}
    server.send(200,"application/json","{\"hash\":\""+hexHash(hash(body))+"\"}");
  });
  server.on("/api/program",HTTP_GET,[]{server.send(200,"text/plain",prefs.getString("blocks",""));});
  server.on("/api/run",HTTP_POST,[]{
    bool ok;{Guard g;stop("Запуск блоків");ok=blockLoaded && server.arg("hash")==hexHash(blockHash) && beginRun(Mode::BLOCKS,millis());}
    reply(ok,ok?"Програму запущено":"Надішліть поточну програму та перевірте батарею");
  });
  server.on("/api/ota/prepare",HTTP_POST,[]{
    const uint32_t now=millis();
    if(pinFailures>=5 && !robot::elapsed(now,lastPinAt,30000)){reply(false,"Зачекайте 30 секунд перед наступною спробою PIN");return;}
    if(server.arg("plain")!=pin){pinFailures++;lastPinAt=now;reply(false,"Неправильний PIN учителя");return;}
    pinFailures=0;
    {Guard g;if(state.voltage<4.6f || state.latch || state.capture){reply(false,"Потрібні заряджені AA та справний робот (VBAT ≥4,6 В)");return;}
      stop("Оновлення: мотори заблоковано");state.maintenance=true;
      for(int i=0;i<4;i++){slew[i].update(0,now,true);writeMotor(i,0);}}
    char key[33];snprintf(key,sizeof(key),"%08lx%08lx%08lx%08lx",(unsigned long)esp_random(),(unsigned long)esp_random(),(unsigned long)esp_random(),(unsigned long)esp_random());token=key;
    otaPreparedAt=now;otaUnlocked=false;otaFailed=false;otaAccepted=false;otaFileSeen=false;otaStreamComplete=false;
    server.send(200,"application/json","{\"token\":\""+token+"\"}");
  });
  server.on("/api/ota/unlock",HTTP_POST,[]{
    if(!tokenValid() || robot::elapsed(millis(),otaPreparedAt,120000) || digitalRead(cfg::BUTTON_PIN)!=LOW){reply(false,"Утримуйте кнопку робота. За потреби повторіть вхід із PIN");return;}
    otaUnlocked=true;otaUnlockedAt=millis();reply(true,"Оновлення дозволене на 60 секунд");
  });
  server.on("/api/ota/cancel",HTTP_POST,[]{if(!tokenValid()){reply(false,"Потрібен чинний сеанс учителя");return;}leaveMaintenance();reply(true,"Оновлення закрито");});
  server.on("/api/ota",HTTP_POST,[]{
    if(otaWriting && otaStreamComplete && !otaFailed && tokenValid()){otaAccepted=Update.end(false);otaFailed=!otaAccepted;}
    if(!otaAccepted){Update.abort();otaFailed=true;}
    if(otaAccepted && !otaFailed){server.send(200,"text/plain; charset=utf-8","Прошивку записано. Перезапуск");rebootPending=true;rebootAt=millis();}
    else server.send(400,"text/plain; charset=utf-8","Оновлення не завершено. Чинна прошивка збережена. Повторіть вхід із PIN");
    otaUnlocked=false;token="";otaWriting=false;
  },[]{
    HTTPUpload& upload=server.upload();
    if(upload.status==UPLOAD_FILE_START){
      if(otaFileSeen){Update.abort();otaWriting=false;otaFailed=true;return;}
      otaFileSeen=true;otaFailed=true;otaAccepted=false;otaReceived=0;otaStreamComplete=false;
      char* end=nullptr;String n=server.arg("size");unsigned long size=strtoul(n.c_str(),&end,10);
      const esp_partition_t* part=esp_ota_get_next_update_partition(nullptr);
      bool safe;{Guard g;safe=state.maintenance&&!state.latch&&state.voltage>=4.6f;}
      if(!safe || !tokenValid() || !otaUnlocked || robot::elapsed(millis(),otaUnlockedAt,60000) || !part || n.isEmpty() || *end || size<10000 || size>part->size)return;
      forceStop("Запис прошивки: не вимикайте живлення");otaExpected=size;
      if(!Update.begin(otaExpected,U_FLASH))return;
      otaWriting=true;otaFailed=false;
    }else if(upload.status==UPLOAD_FILE_WRITE){
      if(!otaWriting||otaFailed)return;
      bool safe;{Guard g;safe=state.maintenance&&!state.latch&&state.voltage>=4.2f;}
      if(!safe || otaReceived+upload.currentSize>otaExpected || Update.write(upload.buf,upload.currentSize)!=upload.currentSize){otaFailed=true;Update.abort();otaWriting=false;return;}
      otaReceived+=upload.currentSize;
    }else if(upload.status==UPLOAD_FILE_END){
      if(otaWriting&&!otaFailed&&otaReceived==otaExpected){otaStreamComplete=true;}
      else {otaFailed=true;Update.abort();otaWriting=false;}
    }else if(upload.status==UPLOAD_FILE_ABORTED){Update.abort();otaFailed=true;otaWriting=false;}
  });
}
void tick(){
  if(rebootPending && robot::elapsed(millis(),rebootAt,1500)){ESP.restart();}
  bool maintenance;{Guard g;maintenance=state.maintenance;}
  if(maintenance && !otaWriting && !rebootPending && robot::elapsed(millis(),otaPreparedAt,120000))leaveMaintenance();
}
}
