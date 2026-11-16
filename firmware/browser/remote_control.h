#pragma once
#include <stdint.h>
namespace mcar {
class RemoteLease {
 uint32_t owner=0,lastSeen=0,sequence=0;
 public:
 static constexpr uint32_t TIMEOUT=900;
 bool expired(uint32_t now)const{return owner&&(uint32_t)(now-lastSeen)>=TIMEOUT;}
 bool claim(uint32_t token,uint32_t now){if(owner||!token)return false;owner=token;lastSeen=now;sequence=0;return true;}
 bool accept(uint32_t token,uint32_t next,uint32_t now){if(!owner||token!=owner||expired(now)||next<=sequence)return false;sequence=next;lastSeen=now;return true;}
 bool active()const{return owner!=0;}
 void clear(){owner=sequence=0;}
};
}
