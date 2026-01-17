#include <Adafruit_NeoPixel.h>

#define LED_PIN 2
#define LED_COUNT 12

Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

float dripPosition = 0.0;
bool dripActive = false;
const int TRAIL_LENGTH = 2;

String incoming = "";

void setup() {
  Serial.begin(115200);
  strip.begin();
  strip.setBrightness(40);
  strip.clear();
  strip.show();
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      handleCommand(incoming);
      incoming = "";
    } else {
      incoming += c;
    }
  }

  strip.clear();

  if (dripActive) {
    float progress = dripPosition / (LED_COUNT - 1);
    float eased = progress * progress;

    dripPosition += 0.25 + (eased * 2.0);

    if (dripPosition >= LED_COUNT - 1) {
        dripPosition = LED_COUNT - 1;
        dripActive = false;
        Serial.println("DRIP_END");
    }

    int mainPos = (int)dripPosition;
    strip.setPixelColor(mainPos, strip.Color(0, 150, 255));

    for (int i = 1; i <= TRAIL_LENGTH; i++) {
        int trailPos = mainPos - i;
        if (trailPos >= 0) {
            int b = 150 - (i * 30);
            if (b > 0) strip.setPixelColor(trailPos, strip.Color(0, b/3, b));
        }
    }
}


  strip.show();
  delay(50);
}

void handleCommand(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;
  if (cmd.startsWith("TICK")) {
    if (!dripActive) {
      dripPosition = 0.0;
      dripActive = true;
    }
  }
}
