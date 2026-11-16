#pragma once
#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <math.h>
namespace usbvm {
constexpr int MAX_CODE=2048, MAX_STACK=64, VARS=16;
struct Instruction {char op; uint8_t reserved[3]; float value;};
static_assert(sizeof(Instruction)==8,"Wire instruction must be eight bytes");
struct Program {Instruction code[MAX_CODE]; uint32_t count=0, checksum=0;};
inline uint32_t crc32(const uint8_t* bytes,size_t size){uint32_t crc=0xffffffff;while(size--){crc^=*bytes++;for(int i=0;i<8;i++)crc=(crc>>1)^((crc&1)?0xedb88320:0);}return crc^0xffffffff;}
inline bool integer(float v,int lo,int hi){return isfinite(v)&&v>=lo&&v<=hi&&v==floorf(v);}
inline bool binary(char op){return op&&strchr("+-*/^<>ENQG",op);}
inline bool outputPin(int pin){switch(pin){case 0:case 2:case 4:case 5:case 12:case 13:case 14:case 15:case 16:case 17:case 18:case 19:case 21:case 22:case 23:case 25:case 26:case 27:case 32:case 33:return true;default:return false;}}
inline bool inputPin(int pin){return outputPin(pin)||pin==34||pin==35||pin==36||pin==39;}
inline bool analogPin(int pin){switch(pin){case 0:case 2:case 4:case 12:case 13:case 14:case 15:case 25:case 26:case 27:case 32:case 33:case 34:case 35:case 36:case 39:return true;default:return false;}}
inline int pops(char op){return binary(op)?2:(op&&strchr("=!IWCop",op)?1:0);}
inline int pushes(char op){return binary(op)||(op&&strchr("PV!rua",op))?1:0;}
inline int eventEntry(const Program& program,int event){for(uint32_t index=0;index<program.count;index++)if(program.code[index].op=='T'&&program.code[index].value==event)return index+1;return -1;}
inline bool remoteProgram(const Program& program){for(uint32_t index=0;index<program.count;index++)if(program.code[index].op=='T')return true;return false;}
inline bool validate(const Program& p){
 if(!p.count||p.count>MAX_CODE||p.code[p.count-1].op!='H')return false;
 const bool remote=remoteProgram(p);uint32_t events=0;int textBytes=0;
 if(remote&&p.code[0].op!='H')return false;
 for(uint32_t i=0;i<p.count;i++){
  auto in=p.code[i];if(!in.op||!strchr("PV=I+-*/^<>ENQG!WLDJCHopruaTMb",in.op)||!isfinite(in.value))return false;
  if(textBytes){if(in.op!='b'||!integer(in.value,32,255)||in.value==127)return false;textBytes--;}
  else if(in.op=='b')return false;
  else if(in.op=='M'){if(!integer(in.value,0,120)||i+1+(uint32_t)in.value>=p.count)return false;textBytes=(int)in.value;}
  if(in.op=='T'){
   if(!integer(in.value,1,16)||!i||p.code[i-1].op!='H'||i+1>=p.count)return false;
   uint32_t mask=1u<<(int)in.value;if(events&mask)return false;events|=mask;
  }
  if(in.reserved[0]||in.reserved[1]||in.reserved[2])return false;
  if(strchr("V=I",in.op)&&!integer(in.value,0,VARS-1))return false;
  if(strchr("JC",in.op)&&!integer(in.value,0,p.count-1))return false;
  if(remote&&strchr("JC",in.op)){
   uint32_t dest=(uint32_t)in.value,first=i<dest?i:dest,last=i>dest?i:dest;
   for(uint32_t cursor=first;cursor<=last;cursor++)if(p.code[cursor].op=='T')return false;
  }
  if(in.op=='L'&&!integer(in.value,0,1))return false;
  if(in.op=='P'&&fabsf(in.value)>1000000)return false;
  if(strchr("oprua",in.op)){
   if(!integer(in.value,0,39))return false;
   int pin=(int)in.value;
   if(remote&&in.op=='a'&&pin<32)return false;
   if(in.op=='a'?!analogPin(pin):in.op=='r'?!inputPin(pin):!outputPin(pin))return false;
  }
  if(!strchr("PV=IJCLopruaTMb",in.op)&&in.value!=0)return false;
 }
 int8_t heights[MAX_CODE];memset(heights,-1,sizeof(heights));uint16_t queue[MAX_CODE];int head=0,tail=0;queue[tail++]=0;heights[0]=0;
 for(uint32_t index=1;index<p.count;index++)if(p.code[index].op=='T'){queue[tail++]=index;heights[index]=0;}
 while(head<tail){int pc=queue[head++];char op=p.code[pc].op;int n=heights[pc]-pops(op);if(n<0)return false;n+=pushes(op);if(n>MAX_STACK)return false;
  if(op=='H'){if(n)return false;continue;}
  int next[2]={pc+1,-1};if(op=='M')next[0]+=(int)p.code[pc].value;if(op=='J')next[0]=(int)p.code[pc].value;if(op=='C')next[1]=(int)p.code[pc].value;
  for(int dest:next){if(dest==-1)continue;if(dest<0||dest>=(int)p.count||p.code[dest].op=='b')return false;if(heights[dest]<0){heights[dest]=n;queue[tail++]=dest;}else if(heights[dest]!=n)return false;}
 }return true;
}
inline bool parse(const uint8_t* bytes,size_t size,Program& p){
 if(size<16||memcmp(bytes,"MCARUSB1",8))return false;
 uint32_t count,crc;memcpy(&count,bytes+8,4);memcpy(&crc,bytes+12,4);
 if(!count||count>MAX_CODE||size!=16+count*8||crc!=crc32(bytes+16,count*8))return false;
 p.count=count;p.checksum=crc;memcpy(p.code,bytes+16,count*8);return validate(p);
}
struct Event {bool ledChanged=false,led=false,done=false;const char* error=nullptr;const char* message=nullptr;};
// Hardware is supplied by Arduino or a deterministic host in the native tests.
struct IO {
 virtual ~IO()=default;
 virtual void write(int pin,bool value)=0;
 virtual bool pwm(int pin,int duty)=0;
 virtual int read(int pin,bool pullup)=0;
 virtual int analog(int pin)=0;
};
class Machine {
 char message[121]={};
 const Program* program=nullptr;float stack[MAX_STACK]={},vars[VARS]={};int sp=0,pc=0;bool finished=true,waiting=false;uint32_t waitAt=0,waitMs=0;
 float pop(){return stack[--sp];}
 bool push(float value){if(!isfinite(value)||fabsf(value)>1000000||sp>=MAX_STACK)return false;stack[sp++]=value;return true;}
 Event fail(const char* reason){finished=true;Event e;e.error=reason;e.done=true;return e;}
 public:
 bool start(const Program& p){if(!validate(p))return false;program=&p;sp=pc=0;memset(vars,0,sizeof(vars));finished=waiting=false;return true;}
 bool startEvent(const Program& next,int event){
  int entry=eventEntry(next,event);if(entry<0||!validate(next))return false;
  if(program!=&next&&!start(next))return false;
  sp=0;pc=entry;finished=waiting=false;return true;
 }
 void stop(){finished=true;waiting=false;sp=0;}
 void reset(){stop();program=nullptr;memset(vars,0,sizeof(vars));}
 bool busy()const{return !finished;}
 Event tick(uint32_t now,IO* io=nullptr){
  if(finished){Event e;e.done=true;return e;}
  if(waiting){if((uint32_t)(now-waitAt)<waitMs)return {};waiting=false;}
  for(int fuel=0;fuel<64;fuel++){
   if(pc<0||pc>=(int)program->count)return fail("invalid jump");
   auto in=program->code[pc++];char op=in.op;int arg=in.value>=0&&in.value<=MAX_CODE?(int)in.value:0;if(sp<pops(op))return fail("stack underflow");
   float a,b,v=0;
   if(binary(op)){b=pop();a=pop();switch(op){case '+':v=a+b;break;case '-':v=a-b;break;case '*':v=a*b;break;case '/':if(b==0)return fail("division by zero");v=a/b;break;case '^':v=powf(a,b);break;case '<':v=a<b;break;case '>':v=a>b;break;case 'E':v=a==b;break;case 'N':v=a!=b;break;case 'Q':v=a<=b;break;case 'G':v=a>=b;break;}if(!push(v))return fail("number out of range");continue;}
   switch(op){
    case 'M':{for(int index=0;index<arg;index++)message[index]=(char)program->code[pc++].value;message[arg]=0;Event event;event.message=message;return event;}
    case 'T':break;
    case 'o':v=pop();if(!integer(v,0,1))return fail("digital output must be 0 or 1");if(!io)return fail("GPIO unavailable");io->write(arg,v!=0);break;
    case 'p':v=pop();if(!integer(v,0,255))return fail("PWM must be integer 0..255");if(!io||!io->pwm(arg,(int)v))return fail("PWM unavailable");break;
    case 'r':case 'u':if(!io)return fail("GPIO unavailable");v=io->read(arg,op=='u');if(!integer(v,0,1)||!push(v))return fail("invalid digital input");break;
    case 'a':if(!io)return fail("GPIO unavailable");v=io->analog(arg);if(!integer(v,0,4095)||!push(v))return fail("invalid analog input");break;
    case 'P':if(!push(in.value))return fail("number out of range");break;
    case 'V':if(!push(vars[arg]))return fail("stack overflow");break;
    case '=':vars[arg]=pop();break;
    case 'I':v=pop();if(v<0||v>1000)return fail("repeat must be 0..1000");vars[arg]=(int)v;break;
    case '!':v=pop();if(!push(v==0))return fail("stack overflow");break;
    case 'J':pc=arg;break;
    case 'C':if(pop()==0)pc=arg;break;
    case 'L':{Event e;e.ledChanged=true;e.led=arg;return e;}
    case 'W':v=pop();if(v<0||v>60)return fail("wait must be 0..60 seconds");waitMs=(uint32_t)(v*1000);waitAt=now;waiting=true;return {};
    case 'D':waitMs=1;waitAt=now;waiting=true;return {};
    case 'H':finished=true;{Event e;e.done=true;return e;}
    default:return fail("unknown instruction");
   }
  }return {}; // Yield even for a busy loop, so the watchdog can run.
 }
};
}
