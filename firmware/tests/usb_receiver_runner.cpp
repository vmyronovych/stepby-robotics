#include "../browser/usb_receiver.h"
#include <iostream>
#include <vector>
#include <string>
#include <cassert>
#include <algorithm>
struct MemoryFlash:mcar::Flash {
 std::vector<uint8_t> data=std::vector<uint8_t>(mcar::PARTITION_SIZE,255);long budget=-1;int mutations=0;
 bool read(size_t off,void* out,size_t size) override {if(off+size>data.size())return false;memcpy(out,data.data()+off,size);return true;}
 bool mutate(size_t off,const uint8_t* bytes,size_t size){if(off+size>data.size())return false;mutations++;for(size_t i=0;i<size;i++){if(budget==0)return false;if(budget>0)--budget;data[off+i]=bytes?(data[off+i]&bytes[i]):255;}return true;}
 bool erase(size_t off,size_t size) override {return mutate(off,nullptr,size);}
 bool write(size_t off,const void* bytes,size_t size) override {return mutate(off,(const uint8_t*)bytes,size);}
};
std::vector<uint8_t> program(bool on){
 usbvm::Instruction code[2]={{'L',{0,0,0},on?1.f:0.f},{'H',{0,0,0},0}};
 std::vector<uint8_t> bytes(32);memcpy(bytes.data(),"MCARUSB1",8);uint32_t count=2,crc=usbvm::crc32((const uint8_t*)code,sizeof(code));memcpy(bytes.data()+8,&count,4);memcpy(bytes.data()+12,&crc,4);memcpy(bytes.data()+16,code,sizeof(code));return bytes;
}
uint32_t checksum(const std::vector<uint8_t>& b){uint32_t crc;memcpy(&crc,b.data()+12,4);return crc;}
void storageTests(){
 const auto old=program(false),next=program(true);MemoryFlash flash;std::copy(old.begin(),old.end(),flash.data.begin());
 mcar::ProgramStore store(flash);usbvm::Program loaded;assert(store.load(loaded)&&loaded.checksum==checksum(old));assert(store.save(next.data(),next.size()));assert(store.load(loaded)&&loaded.checksum==checksum(next));
 const auto baseline=flash.data;
 std::vector<long> cuts={0,1,4095,4096,16384,32767};for(long i=32768;i<=32768+(long)old.size()+24;i++)cuts.push_back(i);
 for(long cut:cuts){MemoryFlash interrupted;interrupted.data=baseline;mcar::ProgramStore writer(interrupted);assert(writer.load(loaded));interrupted.budget=cut;bool saved=writer.save(old.data(),old.size());interrupted.budget=-1;mcar::ProgramStore reboot(interrupted);assert(reboot.load(loaded));assert(loaded.checksum==(saved?checksum(old):checksum(next)));}
 auto broken=old;broken[20]^=1;int before=flash.mutations;assert(!store.save(broken.data(),broken.size()));assert(before==flash.mutations);
 assert(store.save(old.data(),old.size()));flash.data[mcar::SLOT_SIZE-1]^=1;assert(store.load(loaded)&&loaded.checksum==checksum(next));
 // Missing/corrupt new program falls back to the still-valid legacy slot.
 MemoryFlash legacy;std::copy(old.begin(),old.end(),legacy.data.begin());mcar::ProgramStore legacyStore(legacy);assert(legacyStore.load(loaded));legacy.budget=32770;assert(!legacyStore.save(next.data(),next.size()));legacy.budget=-1;mcar::ProgramStore legacyReboot(legacy);assert(legacyReboot.load(loaded)&&loaded.checksum==checksum(old));
 std::cout<<"PASS storage: torn erase/payload/footer, legacy migration, corruption, rollback\n";
}
struct Host:mcar::ReceiverHost {
 MemoryFlash flash;mcar::ProgramStore store{flash};usbvm::Program current;usbvm::Machine vm;bool running=false,quiet=false;int installs=0;std::vector<std::string> replies;
 void reply(const char* line) override {replies.push_back(line);if(!quiet)std::cout<<line<<std::endl;}
 bool install(const uint8_t* bytes,size_t size,const usbvm::Program& p) override {if(!store.save(bytes,size))return false;current=p;running=vm.start(current);installs++;return running;}
 void tick(){if(running){auto e=vm.tick(0);if(e.error){std::cout<<"PROGRAM_ERROR: "<<e.error<<std::endl;running=false;}if(e.done)running=false;}}
};
void feed(mcar::Receiver& r,const std::string& line,uint32_t time=0){for(auto c:line)r.feed(c,time);r.feed('\n',time);}
void receiverTests(){
 Host host;host.quiet=true;mcar::Receiver r(host);const std::string id="0123456789abcdef";
 feed(r,"MCAR2 HELLO "+id);assert(host.replies.back().find("READY "+id+" gpio2-v5")!=std::string::npos);
 feed(r,"MCAR2 BEGIN "+id+" 999999 ffffffff");assert(host.replies.back().find("BAD_HEADER")!=std::string::npos);
 feed(r,"MCAR2 BEGIN "+id+" 32 00000000");r.tick(10001);assert(host.replies.back().find("TIMEOUT")!=std::string::npos&&host.installs==0);
 feed(r,"MCAR2 BEGIN "+id+" 32 00000000");feed(r,"MCAR2 COMMIT "+id);assert(host.replies.back().find("INVALID_PROGRAM")!=std::string::npos&&host.installs==0);
 feed(r,"MCAR2 BEGIN "+id+" 32 00000000");feed(r,"MCAR2 DATA "+id+" 1 ff");assert(host.replies.back().find("BAD_DATA")!=std::string::npos);
 feed(r,"MCAR2 BEGIN "+id+" 32 00000000");feed(r,std::string(900,'x'));assert(host.replies.back().find("LINE_TOO_LONG")!=std::string::npos);
 feed(r,"MCAR2 BEGIN "+id+" 32 00000000");feed(r,"MCAR2 CANCEL "+id);assert(host.replies.back().find("CANCELLED")!=std::string::npos&&host.installs==0);
 std::cout<<"PASS receiver: handshake, bounds, timeout, truncated/malformed transfer, cancel\n";
}
int main(int argc,char** argv){
 if(argc>1&&std::string(argv[1])=="--self-test"){storageTests();receiverTests();return 0;}
 static Host host;static mcar::Receiver receiver(host);std::string line;
 while(std::getline(std::cin,line)){feed(receiver,line);host.tick();}
}
