#include "../browser/usb_vm.h"
#include <fstream>
#include <vector>
#include <iostream>
struct TestIO:usbvm::IO {
 void write(int pin,bool value) override {std::cout<<"WRITE "<<pin<<" "<<value<<"\n";}
 bool pwm(int pin,int duty) override {std::cout<<"PWM "<<pin<<" "<<duty<<"\n";return true;}
 int read(int pin,bool pullup) override {std::cout<<"READ "<<pin<<" "<<pullup<<"\n";return pullup?0:1;}
 int analog(int pin) override {std::cout<<"ANALOG "<<pin<<"\n";return 2048;}
};
int main(int argc,char** argv){
 if(argc<2)return 1;std::ifstream file(argv[1],std::ios::binary);std::vector<uint8_t> bytes((std::istreambuf_iterator<char>(file)),{});
 static usbvm::Program program;if(!usbvm::parse(bytes.data(),bytes.size(),program)){std::cerr<<"INVALID PROGRAM\n";return 2;}
 usbvm::Machine vm;if(!vm.start(program))return 2;
 TestIO gpio;
 for(int action=2;action<argc||action==2;action++){
  if(action<argc){
   const std::string command=argv[action];
   if(command=="reset"){vm.reset();continue;}
   if(command=="reload"){if(!vm.start(program))return 2;vm.stop();continue;}
   if(command=="reboot"){vm=usbvm::Machine();if(!vm.start(program))return 2;vm.stop();continue;}
   if(!vm.startEvent(program,std::stoi(command)))return 2;
  }
  for(uint32_t ms=0;ms<20000;ms++){auto event=vm.tick(ms,&gpio);if(event.error){std::cerr<<"ERROR "<<event.error<<"\n";return 3;}if(event.message)std::cout<<"LOG "<<event.message<<"\n";if(event.ledChanged)std::cout<<ms<<" "<<(event.led?"ON":"OFF")<<"\n";if(event.done){std::cout<<"DONE\n";break;}}
 }
 return 0;
}
