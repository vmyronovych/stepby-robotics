#pragma once
// MCAR2: bounded stack bytecode for Blockly. No eval, dynamic jumps or GPIO access.
#include "control.h"
#include <errno.h>
#include <cmath>
namespace blocks {
constexpr int MAX_CODE=256, MAX_STACK=32, VARS=16;
struct Instruction {char op=0; float value=0;};
struct Program {Instruction code[MAX_CODE]; int count=0;};
inline bool integer(float v,int low,int high){return std::isfinite(v)&&v>=low&&v<=high&&v==floorf(v);}
inline bool withArg(char c){return strchr("PV=IsdMCJ",c)!=nullptr;}
inline bool known(char c){return c && strchr("PV=I+-*/^<>EQGN!&|sd ebtSKFBLRWAYMZHJC",c) && c!=' ';}
inline int pops(char c){
  if(strchr("+-*/^<>EQGN&|",c))return 2;
  if(c=='Y')return 3;if(c=='M')return 2;
  if(strchr("=I!SKFBLRWAC",c))return 1;return 0;
}
inline int pushes(char c){return strchr("PV+-*/^<>EQGN!&|sdebt",c)?1:0;}
inline bool validate(const Program& p){
  if(p.count<1||p.count>MAX_CODE||p.code[p.count-1].op!='H')return false;
  for(int i=0;i<p.count;i++){
    const auto in=p.code[i];if(!known(in.op)||!std::isfinite(in.value))return false;
    if(strchr("V=I",in.op)&&!integer(in.value,0,VARS-1))return false;
    if(strchr("sd",in.op)&&!integer(in.value,0,4))return false;
    if(in.op=='M'&&!integer(in.value,0,3))return false;
    if(strchr("JC",in.op)&&!integer(in.value,0,p.count-1))return false;
    if(in.op=='P'&&fabsf(in.value)>1000000)return false;
  }
  // Dataflow stack validation, including back edges: joins must have equal depth.
  int8_t heights[MAX_CODE];memset(heights,-1,sizeof(heights));
  uint16_t queue[MAX_CODE];int head=0,tail=0;heights[0]=0;queue[tail++]=0;
  while(head<tail){int pc=queue[head++];char op=p.code[pc].op;
    int n=heights[pc]-pops(op);if(n<0)return false;n+=pushes(op);if(n>MAX_STACK)return false;
    if(op=='H'){if(n!=0)return false;continue;}
    int next[2]={pc+1,-1};if(op=='J')next[0]=(int)p.code[pc].value;
    if(op=='C')next[1]=(int)p.code[pc].value;
    for(int dest:next){if(dest==-1)continue;if(dest<0||dest>=p.count)return false;
      if(heights[dest]==-1){heights[dest]=n;queue[tail++]=dest;}
      else if(heights[dest]!=n)return false;
    }
  }
  return true;
}
inline bool parse(const char* text,Program& p){
  p.count=0;if(strncmp(text,"MCAR2\n",6)!=0||strlen(text)>4096)return false;text+=6;
  while(*text){
    if(p.count==MAX_CODE)return false;char op=*text++;if(!known(op))return false;float v=0;
    if(withArg(op)){
      if(*text++!=',')return false;char* end=nullptr;errno=0;v=strtof(text,&end);
      if(end==text||errno==ERANGE||!std::isfinite(v))return false;text=end;
    }
    if(*text!='\n'&&*text!='\0')return false;
    p.code[p.count++]={op,v};if(*text=='\n')text++;
  }
  return validate(p);
}
struct Inputs {int raw[5]={};int white[5]={};int black[5]={};bool calibrated=false,button=false;float battery=0;};
struct Output {int motor[4]={};bool line=false,coast=true,done=false,error=false;const char* reason="";};
class Machine {
  const Program* program=nullptr;float stack[MAX_STACK]={},vars[VARS]={};int sp=0,pc=0;
  bool waiting=false,finished=true;uint32_t waitAt=0,waitMs=0,started=0;Output active;
  float pop(){return stack[--sp];}
  bool push(float v){if(!std::isfinite(v)||fabsf(v)>1000000||sp>=MAX_STACK)return false;stack[sp++]=v;return true;}
  Output fail(const char* reason){finished=true;Output o;o.done=o.error=true;o.reason=reason;return o;}
 public:
  int speed=80;float kp=25;
  void start(const Program& p,uint32_t now,int s,float k){program=&p;sp=pc=0;memset(vars,0,sizeof(vars));waiting=false;finished=false;started=now;speed=s;kp=k;}
  void stop(){finished=true;waiting=false;}
  int position()const{return pc;}
  Output tick(uint32_t now,const Inputs& input){
    if(finished){Output o;o.done=true;return o;}
    if(robot::elapsed(now,started,cfg::MAX_RUN_MS))return fail("Ліміт програми: 120 секунд");
    if(waiting){if(!robot::elapsed(now,waitAt,waitMs))return active;waiting=false;}
    for(int fuel=0;fuel<64;fuel++){
      if(!program||pc<0||pc>=program->count)return fail("Неправильний перехід");
      auto in=program->code[pc++];char op=in.op;int arg=(int)in.value;
      if(sp<pops(op))return fail("Недостатньо значень");
      float a=0,b=0,v=0;
      if(strchr("+-*/^<>EQGN&|",op)){
        b=pop();a=pop();switch(op){case '+':v=a+b;break;case '-':v=a-b;break;case '*':v=a*b;break;
          case '^':v=powf(a,b);break;
          case '/':if(b==0)return fail("Ділення на нуль");v=a/b;break;
          case '<':v=a<b;break;case '>':v=a>b;break;case 'E':v=a==b;break;case 'N':v=a!=b;break;
          case 'Q':v=a<=b;break;case 'G':v=a>=b;break;case '&':v=a!=0&&b!=0;break;case '|':v=a!=0||b!=0;break;}
        if(!push(v))return fail("Значення поза межами");continue;
      }
      switch(op){
        case 'P':if(!push(in.value))return fail("Значення поза межами");break;
        case 'V':if(!push(vars[arg]))return fail("Переповнення значень");break;
        case '=':vars[arg]=pop();break;
        case 'I':v=pop();if(!integer(v,0,50))return fail("Повторити: ціле число 0–50");vars[arg]=v;break;
        case '!':v=pop();if(!push(v==0))return fail("Переповнення значень");break;
        case 's':if(!push(input.raw[arg]))return fail("Переповнення значень");break;
        case 'd':
          if(!input.calibrated||input.black[arg]-input.white[arg]<300)return fail("Спочатку калібрування");
          v=robot::clamp((input.raw[arg]-input.white[arg])*1000/(input.black[arg]-input.white[arg]),0,1000);
          if(!push(v))return fail("Переповнення значень");break;
        case 'e':{if(!input.calibrated)return fail("Спочатку калібрування");auto l=robot::linePosition(input.raw,input.white,input.black);
          if(!l.valid||l.intersection)return fail("Лінію не визначено");if(!push(l.error))return fail("Переповнення значень");break;}
        case 'b':if(!push(input.battery))return fail("Переповнення значень");break;
        case 't':if(!push(input.button?1:0))return fail("Переповнення значень");break;
        case 'S':v=pop();if(!integer(v,0,cfg::MAX_PWM))return fail("Швидкість: ціле 0–180");speed=(int)v;break;
        case 'K':v=pop();if(v<0||v>100)return fail("Kp: від 0 до 100");kp=v;break;
        case 'J':pc=arg;break;case 'C':if(pop()==0)pc=arg;break;
        case 'H':{finished=true;Output o;o.done=true;return o;}
        case 'Z':return Output{};
        case 'F':case 'B':case 'L':case 'R':case 'W':case 'A':case 'Y':case 'M':{
          v=pop();if(!integer(v,20,10000))return fail("Час: від 0,02 до 10 секунд");
          active=Output{};active.coast=(op=='W');active.line=(op=='A');
          if(op=='Y'){b=pop();a=pop();if(!integer(a,-180,180)||!integer(b,-180,180))return fail("Мотори: від −180 до 180");}
          else {a=op=='B'?-speed:(op=='L'||op=='W'?0:speed);b=op=='B'?-speed:(op=='R'||op=='W'?0:speed);}
          if(op=='M'){a=pop();if(!integer(a,-180,180))return fail("Мотор: від −180 до 180");active.motor[arg]=(int)a;}
          else {active.motor[0]=active.motor[2]=(int)a;active.motor[1]=active.motor[3]=(int)b;}
          if(op=='A'&&!input.calibrated)return fail("Спочатку калібрування");
          waitMs=(uint32_t)v;waitAt=now;waiting=true;return active;
        }
        default:return fail("Невідома команда");
      }
    }
    return Output{}; // Busy loops yield to safety task every 64 instructions, motors off.
  }
};
}
