#include "../src/block_vm.h"
#include <cassert>
#include <iostream>
#include <fstream>
#include <sstream>
blocks::Inputs sample(){blocks::Inputs i;i.battery=4.9;i.calibrated=true;for(int n=0;n<5;n++){i.white[n]=100;i.black[n]=3500;i.raw[n]=100;}i.raw[2]=3500;return i;}
int main(int argc,char** argv){
 blocks::Program p;blocks::Machine m;auto in=sample();
 assert(blocks::parse("MCAR2\nP,80\nS\nP,2000\nF\nH\n",p));m.start(p,0,10,25);
 auto o=m.tick(0,in);assert(o.motor[0]==80&&o.motor[3]==80&&!o.coast);assert(!m.tick(1999,in).done);assert(m.tick(2000,in).done);
 for(const char* bad:{"", "MCAR2\nP,nan\nH\n", "MCAR2\nS\nH\n", "MCAR2\nJ,5\nH\n", "MCAR2\nP,3\nH\n", "MCAR2\nV,16\nZ\nH\n", "MCAR2\nP,1\nJ,0\nH\n", "MCAR2\nP,1\nC,4\nP,2\nJ,4\nH\n"})assert(!blocks::parse(bad,p));
 assert(blocks::parse("MCAR2\nP,10\nP,0\n/\nS\nH\n",p));m.start(p,0,80,25);assert(m.tick(0,in).error);
 assert(blocks::parse("MCAR2\nP,80\nP,40\nP,100\nY\nP,-60\nP,100\nM,3\nH\n",p));m.start(p,0,80,25);o=m.tick(0,in);assert(o.motor[0]==80&&o.motor[1]==40&&o.motor[2]==80);o=m.tick(100,in);assert(o.motor[3]==-60&&o.motor[0]==0);
 assert(blocks::parse("MCAR2\nd,2\nP,500\n>\nC,7\nP,100\nF\nJ,9\nP,100\nB\nH\n",p));m.start(p,0,80,25);assert(m.tick(0,in).motor[0]==80);in.raw[2]=100;m.start(p,0,80,25);assert(m.tick(0,in).motor[0]==-80);
 assert(blocks::parse("MCAR2\nJ,0\nH\n",p));m.start(p,0,80,25);assert(!m.tick(0,in).done);assert(m.tick(120000,in).error);
 assert(blocks::parse("MCAR2\nP,100\nA\nH\n",p));in.calibrated=false;m.start(p,0,80,25);assert(m.tick(0,in).error);
 in=sample();assert(blocks::parse("MCAR2\nP,100\nF\nH\n",p));m.start(p,0xfffffff0u,80,25);assert(m.tick(0xfffffff0u,in).motor[0]==80);assert(m.tick(84,in).done);
 // Programs produced by the real Blockly compiler cross the language boundary here.
 for(int f=1;f<argc;f++){std::ifstream file(argv[f]);std::stringstream buffer;buffer<<file.rdbuf();assert(file.good()||file.eof());assert(blocks::parse(buffer.str().c_str(),p));m.start(p,0,80,25);bool completed=false;for(uint32_t t=0;t<=120000;t+=20){o=m.tick(t,in);if(o.done){assert(!o.error);completed=true;break;}}assert(completed);}
 std::cout<<"PASS: VM validation, branching, timed motion, differential/individual motors, division guard, calibration guard, instruction budget, deadline, timer wrap, compiler fixtures\n";
}
