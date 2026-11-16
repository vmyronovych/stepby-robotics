#include <Arduino.h>

// GPIO2 LED confirmed visually by the owner on this board, 2026-11-12.
// Other 38-pin ESP32 board variants may use a different LED arrangement.
constexpr uint8_t kLedPin = 2;
constexpr uint32_t kHalfPeriodMs = 500;

void setup() {
  digitalWrite(kLedPin, LOW);
  pinMode(kLedPin, OUTPUT);
  Serial.begin(115200);
  delay(1000);
  Serial.println("\nMCAR_BLINK_ONLY v1");
  Serial.printf("chip=%s flash=%lu bytes pin=%u half_period=%lu ms\n",
                ESP.getChipModel(), static_cast<unsigned long>(ESP.getFlashChipSize()),
                kLedPin, static_cast<unsigned long>(kHalfPeriodMs));
}

void loop() {
  static bool high = false;
  static uint32_t transitions = 0;
  high = !high;
  digitalWrite(kLedPin, high ? HIGH : LOW);
  Serial.printf("tick=%lu ms=%lu GPIO%u=%s\n",
                static_cast<unsigned long>(++transitions),
                static_cast<unsigned long>(millis()), kLedPin,
                high ? "HIGH" : "LOW");
  delay(kHalfPeriodMs);
}
