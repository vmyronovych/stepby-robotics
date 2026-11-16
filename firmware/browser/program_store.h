#pragma once
#include "usb_vm.h"
#include <limits.h>
namespace mcar {
constexpr size_t MAX_BYTES=16+usbvm::MAX_CODE*8, SLOT_SIZE=32768, PARTITION_SIZE=2*SLOT_SIZE;
struct Flash {
 virtual ~Flash()=default;
 virtual bool read(size_t offset,void* data,size_t size)=0;
 virtual bool erase(size_t offset,size_t size)=0;
 virtual bool write(size_t offset,const void* data,size_t size)=0;
};
struct Footer {char magic[8];uint32_t generation,length,programCrc,footerCrc;};
static_assert(sizeof(Footer)==24,"Stable flash footer layout");
class ProgramStore {
 Flash& flash;uint8_t scratch[MAX_BYTES];usbvm::Program candidate;
 int activeSlot=-1;uint32_t generation=0;
 bool readProgram(int slot,usbvm::Program& out,size_t length=0){
  if(!flash.read(slot*SLOT_SIZE,scratch,16))return false;
  uint32_t count;memcpy(&count,scratch+8,4);
  if(!count||count>usbvm::MAX_CODE)return false;
  size_t size=16+count*8;if(length&&length!=size)return false;
  return flash.read(slot*SLOT_SIZE,scratch,size)&&usbvm::parse(scratch,size,out);
 }
 public:
 explicit ProgramStore(Flash& storage):flash(storage){}
 bool load(usbvm::Program& out){
  activeSlot=-1;generation=0;
  for(int slot=0;slot<2;slot++){
   Footer f;
   if(!flash.read((slot+1)*SLOT_SIZE-sizeof(f),&f,sizeof(f))||memcmp(f.magic,"MCARSLOT",8)||!f.generation||f.length<24||f.length>MAX_BYTES||f.footerCrc!=usbvm::crc32((const uint8_t*)&f,20))continue;
   if(f.generation>generation&&readProgram(slot,candidate,f.length)&&candidate.checksum==f.programCrc){out=candidate;generation=f.generation;activeSlot=slot;}
  }
  if(activeSlot>=0)return true;
  // One-time installation and legacy images place MCARUSB1 at offset zero.
  if(readProgram(0,out)){activeSlot=0;return true;}
  return false;
 }
 bool save(const uint8_t* bytes,size_t length){
  if(length>MAX_BYTES||!usbvm::parse(bytes,length,candidate)||generation==UINT32_MAX)return false;
  int slot=activeSlot==0?1:0;size_t offset=slot*SLOT_SIZE;
  if(!flash.erase(offset,SLOT_SIZE)||!flash.write(offset,bytes,length)||!flash.read(offset,scratch,length)||memcmp(bytes,scratch,length))return false;
  Footer f;memcpy(f.magic,"MCARSLOT",8);f.generation=generation+1;f.length=length;f.programCrc=candidate.checksum;f.footerCrc=usbvm::crc32((const uint8_t*)&f,20);
  // Commit last. A torn transfer/write never erases the current slot.
  Footer check;
  if(!flash.write(offset+SLOT_SIZE-sizeof(f),&f,sizeof(f))||!flash.read(offset+SLOT_SIZE-sizeof(f),&check,sizeof(check))||memcmp(&f,&check,sizeof(f)))return false;
  activeSlot=slot;generation=f.generation;return true;
 }
};
}
