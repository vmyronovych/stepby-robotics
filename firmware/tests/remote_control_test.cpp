#include "../browser/remote_control.h"
#include "../browser/usb_vm.h"
#include <cassert>
int main(){
 mcar::RemoteLease lease;
 assert(!lease.claim(0,0));assert(lease.claim(42,0));assert(!lease.claim(43,1));
 assert(!lease.accept(43,1,10));assert(lease.accept(42,1,10));
 assert(!lease.accept(42,1,20));assert(!lease.accept(42,0,20));
 assert(!lease.expired(909));assert(lease.expired(910));assert(!lease.accept(42,2,910));
 lease.clear();assert(lease.claim(43,UINT32_MAX-100));assert(!lease.expired(798));assert(lease.expired(799));
 static usbvm::Program program;
 program.count=6;program.code[0]={'H',{},0};program.code[1]={'T',{},1};program.code[2]={'P',{},60};program.code[3]={'W',{},0};program.code[4]={'L',{},1};program.code[5]={'H',{},0};
 usbvm::Machine machine;assert(machine.startEvent(program,1));assert(machine.busy());machine.tick(0);machine.stop();assert(!machine.busy());assert(machine.tick(60001).done);assert(!machine.startEvent(program,2));
 assert(machine.startEvent(program,1));machine.tick(0);assert(machine.tick(60000).ledChanged);
}
