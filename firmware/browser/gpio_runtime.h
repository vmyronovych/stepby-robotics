// Generated from web/src/usb-gpio-source.js. Do not edit.

bool mcarPwmPins[40] = {}, mcarOutputPins[40] = {};
void mcarDetach(int pin) {
 if (mcarPwmPins[pin]) { ledcDetach(pin); mcarPwmPins[pin]=false; }
}
void mcarWrite(int pin, bool on) {
 mcarDetach(pin); digitalWrite(pin,on ? HIGH : LOW); pinMode(pin,OUTPUT);
 digitalWrite(pin,on ? HIGH : LOW); mcarOutputPins[pin]=true;
}
bool mcarPwm(int pin, float duty) {
 if (!isfinite(duty) || duty<0 || duty>255 || duty!=floorf(duty)) return false;
 if (!mcarPwmPins[pin]) {
  if (!ledcAttach(pin,5000,8)) return false;
  mcarPwmPins[pin]=true;
 }
 mcarOutputPins[pin]=true; return ledcWrite(pin,(uint32_t)duty);
}
int mcarRead(int pin, bool pullup) {
 mcarDetach(pin); pinMode(pin,pullup ? INPUT_PULLUP : INPUT);
 mcarOutputPins[pin]=false; return digitalRead(pin);
}
int mcarAnalog(int pin) {
 mcarDetach(pin); pinMode(pin,INPUT); mcarOutputPins[pin]=false;
 analogReadResolution(12); analogSetPinAttenuation(pin,ADC_11db);
 return analogRead(pin);
}
void mcarStopPins() {
 for (int pin=0;pin<40;pin++) if (mcarOutputPins[pin]) mcarWrite(pin,false);
}
