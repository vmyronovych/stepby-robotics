#pragma once
#include "program_store.h"
#include <stdio.h>
namespace mcar {
constexpr const char* RUNTIME_ID="gpio2-v5";
struct ReceiverHost {
 virtual ~ReceiverHost()=default;
 virtual void reply(const char* line)=0;
 virtual void info(){}
 virtual bool install(const uint8_t* bytes,size_t size,const usbvm::Program& program)=0;
};
class Receiver {
 ReceiverHost& host;uint8_t bytes[MAX_BYTES];usbvm::Program candidate;
 char line[600]={},nonce[17]={};size_t used=0,expected=0,received=0;
 uint32_t checksum=0,lastActivity=0;bool receiving=false,overflow=false;
 static bool hex(const char* s,size_t length){if(strlen(s)!=length)return false;for(size_t i=0;i<length;i++)if(!((s[i]>='0'&&s[i]<='9')||(s[i]>='a'&&s[i]<='f')))return false;return true;}
 static int nibble(char c){return c<='9'?c-'0':c-'a'+10;}
 static bool decimal(const char* s,size_t& out){out=0;if(!*s)return false;for(;*s;s++){if(*s<'0'||*s>'9'||out>MAX_BYTES)return false;out=out*10+(*s-'0');}return out<=MAX_BYTES;}
 void send(const char* verb,const char* value=""){char message[128];snprintf(message,sizeof(message),"MCAR2 %s %s %s",verb,nonce,value);host.reply(message);}
 void error(const char* value){send("ERROR",value);receiving=false;}
 void command(uint32_t now){
  char* parts[7]={};size_t count=0;char* save=nullptr;
  for(char* s=strtok_r(line," \r",&save);s&&count<7;s=strtok_r(nullptr," \r",&save))parts[count++]=s;
  if(count<3||strcmp(parts[0],"MCAR2")||!hex(parts[2],16))return;
  if(!strcmp(parts[1],"HELLO")&&count==3){char message[128];snprintf(message,sizeof(message),"MCAR2 READY %s %s %u",parts[2],RUNTIME_ID,(unsigned)MAX_BYTES);host.info();host.reply(message);return;}
  if(!strcmp(parts[1],"BEGIN")&&count==5){
   memcpy(nonce,parts[2],17);size_t length;
   if(!decimal(parts[3],length)||length<24||(length-16)%8||!hex(parts[4],8)){error("BAD_HEADER");return;}
   expected=length;checksum=0;for(int i=0;i<8;i++)checksum=(checksum<<4)|nibble(parts[4][i]);received=0;lastActivity=now;receiving=true;send("ACCEPT","0");return;
  }
  if(!receiving||strcmp(parts[2],nonce))return;
  lastActivity=now;
  if(!strcmp(parts[1],"CANCEL")&&count==3){receiving=false;send("CANCELLED");return;}
  if(!strcmp(parts[1],"DATA")&&count==5){
   size_t offset,n=strlen(parts[4]);
   if(!decimal(parts[3],offset)||offset!=received||!n||n>512||n%2||received+n/2>expected||!hex(parts[4],n)){error("BAD_DATA");return;}
   for(size_t i=0;i<n;i+=2)bytes[received++]=(nibble(parts[4][i])<<4)|nibble(parts[4][i+1]);
   char value[16];snprintf(value,sizeof(value),"%u",(unsigned)received);send("ACK",value);return;
  }
  if(!strcmp(parts[1],"COMMIT")&&count==3){
   if(received!=expected||!usbvm::parse(bytes,received,candidate)||candidate.checksum!=checksum){error("INVALID_PROGRAM");return;}
   if(!host.install(bytes,received,candidate)){error("SAVE_FAILED");return;}
   receiving=false;char value[16];snprintf(value,sizeof(value),"%08lx",(unsigned long)checksum);send("SAVED",value);send("RUNNING",value);return;
  }
  error("BAD_COMMAND");
 }
 public:
 explicit Receiver(ReceiverHost& h):host(h){}
 void tick(uint32_t now){if(receiving&&(uint32_t)(now-lastActivity)>10000)error("TIMEOUT");}
 void feed(uint8_t byte,uint32_t now){
  if(byte=='\n'){
   if(!overflow){line[used]=0;command(now);}else if(receiving)error("LINE_TOO_LONG");
   used=0;overflow=false;return;
  }
  if(used<sizeof(line)-1)line[used++]=(char)byte;else overflow=true;
 }
};
}
