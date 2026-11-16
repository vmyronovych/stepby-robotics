// Arduino-ESP32 3.3.0, ESP32 Dev Module / ESP-WROOM-32, DevKit V1 30-pin + expansion 30P.
// Fresh implementation. Not copied from the reference video.
#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>
#include "config.h"
#include "control.h"
#include "web_ui.h"
#include "block_vm.h"

WebServer server(80);
Preferences prefs;
SemaphoreHandle_t stateMutex;
enum class Mode { STOP, MANUAL, LINE, PROGRAM, TEST, BLOCKS };
struct State {
  Mode mode=Mode::STOP;
  int speed=80; float kp=25;
  int raw[5]={}, white[5]={}, black[5]={};
  bool calibrated=false, whiteFresh=false, blackFresh=false;
  int capture=0, captureCount=0; uint32_t captureSum[5]={};
  int left=0,right=0,testMotor=0;
  uint32_t commandAt=0,runAt=0,stepAt=0,lostAt=0,lowAt=0;
  uint32_t manualEpoch=1; // invalidates delayed manual requests after any stop
  bool losing=false,low=false;
  bool latch=false; const char* reason="Готово";
  float voltage=0,error=0;
  robot::Step steps[32]; size_t count=0,index=0;
  bool stepStarted=false,calDirty=false,maintenance=false,preferBlocks=false;
} state;
robot::Slew slew[4];
blocks::Program blockProgram;
blocks::Machine blockMachine;
bool blockLoaded=false;
uint32_t blockHash=0;
bool pwmReady=false;

struct Guard {
  Guard(){xSemaphoreTake(stateMutex,portMAX_DELAY);}
  ~Guard(){xSemaphoreGive(stateMutex);}
};
void stop(const char* reason) {
  blockMachine.stop();
  if(++state.manualEpoch==0)state.manualEpoch=1;
  state.mode=Mode::STOP; state.left=state.right=0;
  state.losing=false; state.reason=reason;
}
void latch(const char* reason) {stop(reason);state.latch=true;}
bool beginRun(Mode mode,uint32_t now) {
  if(state.maintenance || state.latch || state.capture || !pwmReady || state.voltage<4.2f || digitalRead(cfg::BUTTON_PIN)==LOW) return false;
  if(mode==Mode::LINE && !state.calibrated) return false;
  if(mode==Mode::BLOCKS){if(!blockLoaded)return false;blockMachine.start(blockProgram,now,state.speed,state.kp);}
  state.mode=mode;state.runAt=now;state.commandAt=now;
  state.losing=false;state.index=0;state.stepStarted=false;state.reason="Рух";
  return true;
}
bool followLine(uint32_t now,int& left,int& right) {
  if(!state.calibrated){stop("Спочатку калібрування");return false;}
  auto line=robot::linePosition(state.raw,state.white,state.black);
  if(line.intersection){stop("Перехрестя: зупинка");return false;}
  if(!line.valid){
    left=right=0; // coast immediately; latch mode STOP after 100 ms
    if(!state.losing){state.losing=true;state.lostAt=now;}
    if(robot::elapsed(now,state.lostAt,100)) stop("Лінію втрачено");
    return false;
  }
  state.losing=false;state.error=line.error;
  robot::proportional(line.error,state.speed,state.kp,left,right);return true;
}
void programTick(uint32_t now,int& left,int& right) {
  // Execute zero-duration setting blocks in a bounded loop.
  for(int n=0;n<33;n++) {
    if(state.index>=state.count){stop("Програму завершено");return;}
    auto step=state.steps[state.index];
    if(step.op=='S'){state.speed=step.value;state.index++;continue;}
    if(step.op=='K'){state.kp=step.value/10.0f;state.index++;continue;}
    if(step.op=='X'){stop("Блок зупинки");return;}
    if(!state.stepStarted){state.stepAt=now;state.stepStarted=true;}
    if(robot::elapsed(now,state.stepAt,step.value)){
      state.index++;state.stepStarted=false;continue;
    }
    int s=state.speed;
    switch(step.op){
      case 'F':left=s;right=s;break;
      case 'B':left=-s;right=-s;break;
      case 'L':left=0;right=s;break;
      case 'R':left=s;right=0;break;
      case 'W':left=right=0;break;
      case 'A':followLine(now,left,right);break;
      default:stop("Помилка програми");break;
    }
    return;
  }
  stop("Забагато блоків");
}
void writeMotor(int i,int value) {
  value*=cfg::MOTOR_SIGN[i];
  // Inactive leg first; 0/0 = coast. Never request 1/1 braking here.
  if(value>=0){ledcWrite(cfg::MOTOR_PINS[i][1],0);ledcWrite(cfg::MOTOR_PINS[i][0],value);}
  else {ledcWrite(cfg::MOTOR_PINS[i][0],0);ledcWrite(cfg::MOTOR_PINS[i][1],-value);}
}
void controlTask(void*) {
  TickType_t wake=xTaskGetTickCount();
  bool lastRaw=false,stable=false,buttonArmed=false,startOnRelease=false; uint32_t changed=0,pressed=0,pressEpoch=0;
  for(;;){
    uint32_t now=millis();
    int raw[5];for(int i=0;i<5;i++)raw[i]=analogRead(cfg::SENSOR_PINS[i]);
    float voltage=analogReadMilliVolts(cfg::BATTERY_PIN)*cfg::BATTERY_SCALE/1000.0f;
    bool fault=(!digitalRead(cfg::FAULT_PINS[0]) || !digitalRead(cfg::FAULT_PINS[1]));
    bool button=!digitalRead(cfg::BUTTON_PIN);
    {
      Guard guard;
      memcpy(state.raw,raw,sizeof(raw));state.voltage=voltage;
      if(fault)latch("Драйвер: вимкніть живлення");
      if(voltage<4.2f){
        if(!state.low){state.low=true;state.lowAt=now;}
        if(robot::elapsed(now,state.lowAt,500))latch("Зарядіть AA / перевірте живлення");
      } else state.low=false;
      if(state.capture){
        for(int i=0;i<5;i++)state.captureSum[i]+=raw[i];
        if(++state.captureCount>=32){
          int* dest=state.capture==1?state.white:state.black;
          for(int i=0;i<5;i++)dest[i]=state.captureSum[i]/32;
          if(state.capture==1)state.whiteFresh=true;else state.blackFresh=true;
          state.capture=0;
          state.calibrated=state.whiteFresh && state.blackFresh;
          for(int i=0;i<5;i++)if(state.black[i]-state.white[i]<300)state.calibrated=false;
          state.calDirty=true;
          state.reason=state.calibrated?"Калібрування збережено":"Потрібні біле і чорне, контраст ≥300";
        }
      }
      if(state.maintenance)startOnRelease=false;
      // Ignore a button held at boot until released. Short release=line, long=program.
      if(!button)buttonArmed=true;
      if(button!=lastRaw){lastRaw=button;changed=now;}
      if(button!=stable && robot::elapsed(now,changed,40)){
        stable=button;
        if(stable){pressed=now;pressEpoch=state.manualEpoch;startOnRelease=buttonArmed && !state.maintenance && state.mode==Mode::STOP;if(!startOnRelease)stop("Кнопка: стоп");}
        else if(startOnRelease && state.mode==Mode::STOP && pressEpoch==state.manualEpoch && robot::elapsed(now,pressed,40)){
          {
            if(robot::elapsed(now,pressed,1000)){
              if(state.preferBlocks && blockLoaded)beginRun(Mode::BLOCKS,now);
              else if(state.count)beginRun(Mode::PROGRAM,now);
            }else beginRun(Mode::LINE,now);
          }
        }
      }
      int left=0,right=0;int blockTargets[4]={};bool immediate=state.mode==Mode::STOP || state.latch || state.capture || state.maintenance;
      if(!immediate){
        if(robot::elapsed(now,state.runAt,cfg::MAX_RUN_MS))stop("Ліміт 120 секунд");
        switch(state.mode){
          case Mode::MANUAL:
            if(robot::elapsed(now,state.commandAt,cfg::MANUAL_TIMEOUT_MS))stop("Ручне керування: тайм-аут");
            else {left=state.left;right=state.right;}break;
          case Mode::LINE:if(!followLine(now,left,right))immediate=true;break;
          case Mode::PROGRAM:programTick(now,left,right);if(state.losing)immediate=true;break;
          case Mode::BLOCKS:{
            blocks::Inputs in;memcpy(in.raw,state.raw,sizeof(in.raw));memcpy(in.white,state.white,sizeof(in.white));memcpy(in.black,state.black,sizeof(in.black));
            in.calibrated=state.calibrated;in.battery=state.voltage;in.button=button;
            auto out=blockMachine.tick(now,in);state.speed=blockMachine.speed;state.kp=blockMachine.kp;
            if(out.done){stop(out.error?out.reason:"Програму блоків завершено");immediate=true;}
            else if(out.line){if(!followLine(now,left,right))immediate=true;blockTargets[0]=blockTargets[2]=left;blockTargets[1]=blockTargets[3]=right;}
            else {memcpy(blockTargets,out.motor,sizeof(blockTargets));immediate=out.coast;}
            break;
          }
          case Mode::TEST:
            if(robot::elapsed(now,state.commandAt,300))stop("Тест завершено");break;
          default:break;
        }
      }
      immediate=immediate || state.mode==Mode::STOP || state.latch;
      for(int i=0;i<4;i++){
        int target=(i==0||i==2)?left:right;
        if(state.mode==Mode::BLOCKS)target=blockTargets[i];
        if(state.mode==Mode::TEST)target=i==state.testMotor?60:0;
        writeMotor(i,slew[i].update(target,now,immediate));
      }
    }
    vTaskDelayUntil(&wake,pdMS_TO_TICKS(20));
  }
}
bool numberArg(const char* name,float low,float high,float& value){
  if(!server.hasArg(name))return false;
  String text=server.arg(name);char* end=nullptr;value=strtof(text.c_str(),&end);
  return end!=text.c_str() && *end=='\0' && isfinite(value) && value>=low && value<=high;
}
void reply(bool ok,const char* message){server.send(ok?200:400,"text/plain; charset=utf-8",message);}
#include "workshop_api.h"

void setup(){
  // External pull-downs keep motors off before software starts.
  for(auto& pair:cfg::MOTOR_PINS)for(auto pin:pair){pinMode(pin,OUTPUT);digitalWrite(pin,LOW);}
  stateMutex=xSemaphoreCreateMutex();if(!stateMutex){while(true)delay(1000);}
  pwmReady=true;
  for(auto& pair:cfg::MOTOR_PINS)for(auto pin:pair){
    if(!ledcAttach(pin,cfg::PWM_HZ,cfg::PWM_BITS))pwmReady=false;
    ledcWrite(pin,0);
  }
  if(!pwmReady){while(true)delay(1000);} // no task, no motion after PWM failure
  Serial.begin(115200);
  analogReadResolution(12);
  for(auto pin:cfg::SENSOR_PINS){pinMode(pin,INPUT);analogSetPinAttenuation(pin,ADC_11db);}
  pinMode(cfg::BATTERY_PIN,INPUT);analogSetPinAttenuation(cfg::BATTERY_PIN,ADC_11db);
  for(auto pin:cfg::FAULT_PINS)pinMode(pin,INPUT_PULLUP);
  pinMode(cfg::BUTTON_PIN,INPUT_PULLUP);
  prefs.begin("mandrivnyk",false);
  bool calSize=prefs.getBytesLength("white")==sizeof(state.white) && prefs.getBytesLength("black")==sizeof(state.black);
  if(calSize){prefs.getBytes("white",state.white,sizeof(state.white));prefs.getBytes("black",state.black,sizeof(state.black));}
  state.calibrated=calSize && prefs.getBool("cal",false);
  for(int i=0;i<5;i++)if(state.black[i]-state.white[i]<300)state.calibrated=false;
  String stored=prefs.getString("program","");
  if(!stored.isEmpty() && !robot::parseProgram(stored.c_str(),state.steps,state.count))state.count=0;
  String storedBlocks=prefs.getString("blocks","");
  blockLoaded=blocks::parse(storedBlocks.c_str(),blockProgram);
  if(blockLoaded){blockHash=workshop::hash(storedBlocks);state.preferBlocks=true;}
  if(xTaskCreatePinnedToCore(controlTask,"motion",4096,nullptr,2,nullptr,1)!=pdPASS){
    while(true)delay(1000);
  }
  WiFi.mode(WIFI_AP);
  uint32_t suffix=(uint32_t)ESP.getEfuseMac() & 0xFFFFFF;
  char ssid[32];snprintf(ssid,sizeof(ssid),"Mandrivnyk-%06lX",(unsigned long)suffix);
  WiFi.softAPConfig(IPAddress(192,168,4,1),IPAddress(192,168,4,1),IPAddress(255,255,255,0));
  WiFi.softAP(ssid,cfg::WIFI_PASSWORD,1,false,1);
  Serial.printf("%s http://192.168.4.1\n",ssid);
  server.on("/control",HTTP_GET,[]{server.send_P(200,"text/html; charset=utf-8",WEB_UI);});
  server.on("/stop",HTTP_POST,[]{{Guard g;stop("Стоп");}reply(true,"Зупинено");});
  server.on("/settings",HTTP_POST,[]{
    float speed,kp;bool ok=numberArg("speed",0,cfg::MAX_PWM,speed)&&numberArg("kp",0,100,kp);
    if(ok){Guard g;state.speed=(int)speed;state.kp=kp;
      if(state.mode==Mode::BLOCKS){blockMachine.speed=state.speed;blockMachine.kp=state.kp;}
      if(state.mode==Mode::MANUAL)stop("Налаштовано: натисніть напрям ще раз");}
    reply(ok,ok?"Налаштовано":"Швидкість 0–180; Kp 0–100");
  });
  server.on("/arm",HTTP_GET,[]{String epoch;{Guard g;epoch=String(state.manualEpoch);}server.send(200,"text/plain",epoch);});
  server.on("/drive",HTTP_POST,[]{
    String dir=server.arg("dir");bool ok=dir=="F"||dir=="B"||dir=="L"||dir=="R";
    String epochText=server.arg("epoch");char* end=nullptr;
    unsigned long epoch=strtoul(epochText.c_str(),&end,10);
    ok=ok && epochText.length()>0 && epochText.length()<=10 &&
       epochText[0]>='0' && epochText[0]<='9' && *end=='\0' && epoch>0;
    if(ok){Guard g;uint32_t now=millis();
      ok=epoch==state.manualEpoch;
      if(ok && state.mode!=Mode::MANUAL)ok=beginRun(Mode::MANUAL,now);
      if(ok){int s=state.speed;state.left=dir=="B"?-s:(dir=="L"?0:s);state.right=dir=="B"?-s:(dir=="R"?0:s);state.commandAt=now;}
    }reply(ok,ok?"Рух":"Команда недоступна");
  });
  server.on("/line",HTTP_POST,[]{bool ok;{Guard g;stop("Новий режим");ok=beginRun(Mode::LINE,millis());}reply(ok,ok?"Лінія":"Перевірте калібрування і батарею");});
  server.on("/test",HTTP_POST,[]{float motor;bool ok=numberArg("m",0,3,motor)&&motor==(int)motor;
    if(ok){Guard g;ok=state.mode==Mode::STOP;if(ok){stop("Тест");ok=beginRun(Mode::TEST,millis());}if(ok)state.testMotor=(int)motor;}
    reply(ok,ok?"Тест 300 мс":"Спочатку зупиніть робот");
  });
  server.on("/cal",HTTP_POST,[]{String surface=server.arg("surface");bool ok=surface=="white"||surface=="black";
    if(ok){Guard g;if(state.maintenance)ok=false;}
    if(ok){Guard g;stop("Калібрування");state.calibrated=false;
      if(surface=="white"){state.whiteFresh=false;state.blackFresh=false;}
      state.capture=surface=="white"?1:2;state.captureCount=0;memset(state.captureSum,0,sizeof(state.captureSum));
    }reply(ok,ok?"Тримайте нерухомо одну секунду":"Невідома поверхня");
  });
  server.on("/program",HTTP_POST,[]{String body=server.arg("plain");robot::Step candidate[32];size_t count=0;
    bool ok=body.length()<=512 && robot::parseProgram(body.c_str(),candidate,count);
    if(ok){Guard g;if(state.maintenance)ok=false;}
    if(ok){{Guard g;stop("Програму збережено");state.preferBlocks=false;memcpy(state.steps,candidate,count*sizeof(robot::Step));state.count=count;}
      prefs.putString("program",body);}
    reply(ok,ok?"Збережено в роботі":"Неприпустима програма");
  });
  server.on("/program",HTTP_GET,[]{server.send(200,"text/plain",prefs.getString("program",""));});
  server.on("/run",HTTP_POST,[]{bool ok;{Guard g;stop("Новий режим");ok=state.count>0 && beginRun(Mode::PROGRAM,millis());}reply(ok,ok?"Програму запущено":"Перевірте програму і батарею");});
  server.on("/status",HTTP_GET,[]{
    String json;{Guard g;json="{\"reason\":\""+String(state.reason)+"\",\"voltage\":"+String(state.voltage,2)+
      ",\"calibrated\":"+(state.calibrated?"true":"false")+",\"speed\":"+String(state.speed)+",\"kp\":"+String(state.kp,1)+
      ",\"maintenance\":"+(state.maintenance?"true":"false")+",\"mode\":"+String((int)state.mode)+",\"raw\":[";
      for(int i=0;i<5;i++){if(i)json+=",";json+=state.raw[i];}json+="]}";}
    server.send(200,"application/json; charset=utf-8",json);
  });
  workshop::registerRoutes(ssid);
  server.onNotFound([]{server.send(404,"text/plain","Not found");});
  server.begin();
}
void loop(){
  workshop::tick();
  server.handleClient(); // Motion task retains timeout protection even during slow HTTP.
  int white[5],black[5];bool save=false,valid=false;
  {Guard g;if(state.calDirty){state.calDirty=false;save=true;valid=state.calibrated;memcpy(white,state.white,sizeof(white));memcpy(black,state.black,sizeof(black));}}
  if(save){prefs.putBool("cal",false);prefs.putBytes("white",white,sizeof(white));prefs.putBytes("black",black,sizeof(black));prefs.putBool("cal",valid);}
  delay(2);
}
