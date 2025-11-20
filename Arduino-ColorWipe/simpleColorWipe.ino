

#include <Adafruit_NeoPixel.h>

#define LED_PIN 2
#define LED_COUNT 12

Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);


float dripPosition = 0.0;
unsigned long lastDripTime = 0;
const unsigned long DRIP_INTERVAL = 1000; // 1 second between drips
bool dripActive = false;
const int TRAIL_LENGTH = 4; // Length of fading trail

void setup() {
  strip.begin();
  strip.setBrightness(10);
  strip.clear();
  strip.show();
}

void loop() {
  unsigned long currentTime = millis();
  
  // Start a new drip every second
  if (currentTime - lastDripTime >= DRIP_INTERVAL) {
    dripPosition = 0.0;
    dripActive = true;
    lastDripTime = currentTime;
  }
  

  strip.clear();
  
  if (dripActive) {

    float progress = dripPosition / (LED_COUNT - 1);
    float easedProgress = progress * progress;
    

    dripPosition += 0.15 + (easedProgress * 0.3);
    

    if (dripPosition >= LED_COUNT) {
      dripActive = false;
    } else {

      int mainPos = (int)dripPosition;
      if (mainPos < LED_COUNT) {
        strip.setPixelColor(mainPos, 0, 150, 255);
      }
      
      for (int i = 1; i <= TRAIL_LENGTH; i++) {
        int trailPos = mainPos - i;
        if (trailPos >= 0) {
          int brightness = 150 - (i * 30);
          if (brightness > 0) {
            strip.setPixelColor(trailPos, 0, brightness/3, brightness);
          }
        }
      }
    }
  }
  
  strip.show();
  delay(50);
}