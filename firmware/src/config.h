#pragma once
#include <stdint.h>
namespace cfg {
constexpr uint8_t MOTOR_PINS[4][2] = {{16,17},{18,19},{23,25},{26,27}};
constexpr int MOTOR_SIGN[4] = {1,1,1,1}; // LF, RF, LR, RR: qualify harness first.
constexpr uint8_t SENSOR_PINS[5] = {32,33,34,35,36}; // physical left -> right
constexpr uint8_t BATTERY_PIN = 39;
constexpr uint8_t FAULT_PINS[2] = {21,22};
constexpr uint8_t BUTTON_PIN = 13;
constexpr float BATTERY_SCALE = 2.0f; // divider, calibrate against meter after D0
constexpr uint32_t PWM_HZ = 20000;
constexpr uint8_t PWM_BITS = 8;
constexpr int MAX_PWM = 180;
constexpr uint32_t MANUAL_TIMEOUT_MS = 350;
constexpr uint32_t MAX_RUN_MS = 120000;
constexpr char WIFI_PASSWORD[] = "Mandrivnyk32"; // classroom default, change per kit
}
