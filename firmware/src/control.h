#pragma once
#include <stdint.h>
#include <stddef.h>
#include <math.h>
#include <stdlib.h>
#include <string.h>
#include "config.h"

namespace robot {
inline int clamp(int v, int lo, int hi) { return v < lo ? lo : (v > hi ? hi : v); }
inline bool elapsed(uint32_t now, uint32_t since, uint32_t duration) {
  return uint32_t(now - since) >= duration;
}
struct Step { char op; uint32_t value; };
// Strict, finite, bounded language. No arbitrary code execution.
inline bool parseProgram(const char* text, Step* out, size_t& count) {
  count=0; uint32_t total=0; const char* p=text;
  while (*p) {
    if (count>=32) return false;
    char op=*p++;
    if (!strchr("SFBLRWXKA", op) || *p++ != ',') return false;
    if (*p<'0' || *p>'9') return false;
    char* end=nullptr; unsigned long v=strtoul(p,&end,10);
    if (end==p || (*end!='\n' && *end!='\0') || v>120000) return false;
    if ((op=='S' && v>cfg::MAX_PWM) || (op=='K' && v>1000) ||
        (op=='X' && v!=0)) return false;
    if (strchr("FBLRWA",op)) {
      if (v<20 || v>10000) return false;
      total+=v; if(total>cfg::MAX_RUN_MS) return false;
    }
    out[count++]={op,static_cast<uint32_t>(v)};
    p=(*end=='\n') ? end+1 : end;
  }
  return count>0;
}
struct Line { bool valid; bool intersection; float error; };
inline Line linePosition(const int* raw, const int* white, const int* black) {
  float sum=0, weighted=0; int dark=0;
  for (int i=0;i<5;i++) {
    if (black[i]-white[i]<300) return {false,false,0};
    int v=clamp((raw[i]-white[i])*1000/(black[i]-white[i]),0,1000);
    sum+=v; weighted+=v*(i-2); if(v>750) dark++;
  }
  return {sum>=150, dark==5, sum>=150 ? weighted/sum : 0};
}
inline void proportional(float error,int speed,float kp,int& left,int& right) {
  if(speed<=0) {left=right=0;return;}
  // Positive error = line to the right -> left wheels faster.
  int correction=static_cast<int>(lroundf(kp*error));
  left=clamp(speed+correction,0,cfg::MAX_PWM);
  right=clamp(speed-correction,0,cfg::MAX_PWM);
}
// Per-motor slew and coast interval before a polarity reversal.
struct Slew {
  int current=0, lastDirection=0; uint32_t zeroSince=0;
  int update(int target,uint32_t now,bool emergency=false) {
    target=clamp(target,-cfg::MAX_PWM,cfg::MAX_PWM);
    if(emergency) {current=0;zeroSince=now;return 0;}
    int sign=target>0?1:(target<0?-1:0);
    if(current!=0 && sign!=0 && ((current>0)!=(target>0))) target=0;
    if(current==0 && sign!=0 && sign!=lastDirection && lastDirection!=0 &&
       !elapsed(now,zeroSince,100)) return 0;
    int old=current;
    current+=clamp(target-current,-6,6);
    if(current==0 && old!=0) zeroSince=now;
    if(current!=0) lastDirection=current>0?1:-1;
    return current;
  }
};
}
