#include <Arduino.h>
#include <new>
SET_LOOP_TASK_STACK_SIZE(16384);
#include <esp_partition.h>
#include "usb_vm.h"
#include "gpio_runtime.h"
#include "usb_receiver.h"
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
static SemaphoreHandle_t runtimeMutex=nullptr;
struct RuntimeGuard {
 RuntimeGuard(){xSemaphoreTakeRecursive(runtimeMutex,portMAX_DELAY);}
 ~RuntimeGuard(){xSemaphoreGiveRecursive(runtimeMutex);}
};
constexpr uint8_t LED_PIN=2;
static usbvm::Program program;
static usbvm::Machine machine;
static bool stopped=false;
namespace remote {void changed();void configure();void connectionInfo();}
static const esp_partition_t* partition=nullptr;
struct PartitionFlash:mcar::Flash {
 bool read(size_t offset,void* data,size_t size) override {return partition&&esp_partition_read(partition,offset,data,size)==ESP_OK;}
 bool erase(size_t offset,size_t size) override {return partition&&esp_partition_erase_range(partition,offset,size)==ESP_OK;}
 bool write(size_t offset,const void* data,size_t size) override {return partition&&esp_partition_write(partition,offset,data,size)==ESP_OK;}
};
static PartitionFlash flash;
static mcar::ProgramStore store(flash);
struct UploadHost:mcar::ReceiverHost {
 void reply(const char* line) override {Serial.println(line);}
 void info() override {remote::connectionInfo();}
 bool install(const uint8_t* bytes,size_t size,const usbvm::Program& next) override {
  remote::changed();
  if(!store.save(bytes,size))return false;
  program=next;remote::configure();stopped=usbvm::remoteProgram(program);
  if(!machine.start(program))return false;
  if(stopped)machine.stop();return true;
 }
};
static UploadHost uploadHost;
static mcar::Receiver* receiver=nullptr;
struct ArduinoIO:usbvm::IO {
 void write(int pin,bool value) override {mcarWrite(pin,value);}
 bool pwm(int pin,int duty) override {return mcarPwm(pin,duty);}
 int read(int pin,bool pullup) override {return mcarRead(pin,pullup);}
 int analog(int pin) override {return mcarAnalog(pin);}
};
static ArduinoIO gpio;
void printConsole(const char* message){
 static uint32_t windowAt=0,emitted=0,dropped=0;
 uint32_t now=millis();size_t length=strlen(message);
 if((uint32_t)(now-windowAt)>=1000){windowAt=now;emitted=0;}
 if(emitted>=10||Serial.availableForWrite()<(int)(length*2+60)){dropped++;return;}
 if(dropped){Serial.printf("MCAR_LOG_DROPPED %lu\n",(unsigned long)dropped);dropped=0;}
 char line[251];memcpy(line,"MCAR_LOG ",9);
 const char* digits="0123456789abcdef";
 for(size_t index=0;index<length;index++){uint8_t byte=(uint8_t)message[index];line[9+index*2]=digits[byte>>4];line[10+index*2]=digits[byte&15];}
 line[9+length*2]='\n';Serial.write((const uint8_t*)line,10+length*2);emitted++;
}
#include "remote_wifi.h"
void failProgram(const char* message){remote::stop();Serial.printf("PROGRAM_ERROR: %s\n",message);}
void setup(){
 runtimeMutex=xSemaphoreCreateRecursiveMutex();
 if(!runtimeMutex){while(true)delay(1000);}
 RuntimeGuard guard;
 receiver=new(std::nothrow) mcar::Receiver(uploadHost);
 if(!receiver){while(true)delay(1000);}
 mcarWrite(LED_PIN,false);Serial.setTxBufferSize(2048);Serial.begin(115200);delay(1500);
 partition=esp_partition_find_first(ESP_PARTITION_TYPE_DATA,(esp_partition_subtype_t)0x40,"program");
 if(!partition||partition->size<mcar::PARTITION_SIZE){failProgram("program partition missing");return;}
 bool loaded=store.load(program);
 remote::setup();
 if(!loaded){failProgram("invalid program; upload a new algorithm");return;}
 if(!machine.start(program)){failProgram("invalid program; upload a new algorithm");return;}
 if(usbvm::remoteProgram(program)){machine.stop();stopped=true;}
 Serial.printf("MCAR_BROWSER_V1 BOOT %08lx\n",(unsigned long)program.checksum);
}
void loop(){
 {
 RuntimeGuard guard;
 remote::tick();
 receiver->tick(millis());
 for(int budget=0;budget<256&&Serial.available();budget++)receiver->feed((uint8_t)Serial.read(),millis());
 if(!stopped){auto event=machine.tick(millis(),&gpio);if(event.error)failProgram(event.error);else if(event.message)printConsole(event.message);else if(event.ledChanged){mcarWrite(LED_PIN,event.led);Serial.printf("LED2=%s ms=%lu\n",event.led?"ON":"OFF",(unsigned long)millis());}else if(event.done){Serial.println("MCAR_BROWSER_V1 DONE");stopped=true;}}
 }
 delay(1);
}
