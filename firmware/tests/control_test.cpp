#include "../src/control.h"
#include <cassert>
#include <iostream>
int main(){
  int white[5]={100,100,100,100,100},black[5]={3500,3500,3500,3500,3500};
  int center[5]={100,100,3500,100,100},right[5]={100,100,100,100,3500};
  int left[5]={3500,100,100,100,100},lost[5]={100,100,100,100,100};
  assert(robot::linePosition(center,white,black).error==0);
  assert(robot::linePosition(right,white,black).error==2);
  assert(robot::linePosition(left,white,black).error==-2);
  assert(!robot::linePosition(lost,white,black).valid);
  assert(robot::linePosition(black,white,black).intersection);
  int l,r;robot::proportional(2,80,25,l,r);assert(l==130&&r==30);
  robot::proportional(-2,80,25,l,r);assert(l==30&&r==130);
  robot::proportional(2,0,100,l,r);assert(l==0&&r==0);
  robot::proportional(2,180,100,l,r);assert(l==180&&r==0);
  robot::Step p[32];size_t count;
  assert(robot::parseProgram("S,80\nF,2000\nL,700\nX,0\n",p,count)&&count==4);
  for(auto bad:{"","F,-1","F,99999999","S,181","K,1001","Q,10","F,20extra","F,20\n\n","F,","X,1","W,0","F,20,3"})
    assert(!robot::parseProgram(bad,p,count));
  std::string longProgram;for(int i=0;i<13;i++)longProgram+="F,10000\n";
  assert(!robot::parseProgram(longProgram.c_str(),p,count));
  assert(robot::elapsed(15,0xfffffff0u,30));
  robot::Slew slew;
  for(uint32_t t=0;t<400;t+=20)slew.update(80,t);
  assert(slew.current==80);
  uint32_t zero=0;for(uint32_t t=400;t<1000;t+=20){int v=slew.update(-80,t);if(v==0&&!zero)zero=t;if(v<0)assert(t-zero>=100);}
  assert(slew.current<0);assert(slew.update(80,1000,true)==0);
  std::cout<<"PASS: line position, steering sign, saturation, zero speed, parser limits, timer wrap, reversal coast, emergency stop\n";
}
