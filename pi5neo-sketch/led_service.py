#!/usr/bin/env python3

import time
import json
import threading
from rpi_ws281x import *
import websocket

# =====================================================
# LED STRIP CONFIGURATION
# =====================================================
LED_COUNT      = 18      # Number of LEDs
LED_PIN        = 18      # GPIO18 (PWM recommended)
LED_FREQ_HZ    = 800000
LED_DMA        = 10
LED_BRIGHTNESS = 40
LED_INVERT     = False
LED_CHANNEL    = 0

# =====================================================
# DRIP EFFECT PARAMETERS
# =====================================================
TRAIL_LENGTH = 2
drip_position = 0.0
drip_active = False

# =====================================================
# STRIP SETUP
# =====================================================
strip = Adafruit_NeoPixel(
    LED_COUNT,
    LED_PIN,
    LED_FREQ_HZ,
    LED_DMA,
    LED_INVERT,
    LED_BRIGHTNESS,
    LED_CHANNEL
)

strip.begin()

# Clear strip at startup
for i in range(strip.numPixels()):
    strip.setPixelColor(i, 0)
strip.show()

print("LED service ready. Connecting to WebSocket server...")

# =====================================================
# WEBSOCKET HANDLERS
# =====================================================
def on_message(ws, msg):
    global drip_active, drip_position
    try:
        data = json.loads(msg)
        if data.get("type") == "TICK":
            if not drip_active:
                drip_position = 0.0
                drip_active = True
    except json.JSONDecodeError:
        pass

def on_error(ws, error):
    print(f"WebSocket error: {error}")

def on_close(ws, close_status_code, close_msg):
    print("WebSocket connection closed")

def on_open(ws):
    print("WebSocket connected to server")

# =====================================================
# MAIN LOOP
# =====================================================
try:
    ws = websocket.WebSocketApp(
        "ws://localhost:3000",
        on_message=on_message,
        on_error=on_error,
        on_close=on_close,
        on_open=on_open
    )
    
    # Run WebSocket in background thread
    ws_thread = threading.Thread(target=ws.run_forever)
    ws_thread.daemon = True
    ws_thread.start()
    
    # Animation loop
    while True:
        # -------- Clear frame buffer --------
        for i in range(strip.numPixels()):
            strip.setPixelColor(i, 0)

        # -------- Drip animation --------
        if drip_active:
            progress = drip_position / (LED_COUNT - 1)
            eased = progress * progress

            drip_position += 0.25 + (eased * 2.0)

            if drip_position >= LED_COUNT - 1:
                drip_position = LED_COUNT - 1
                drip_active = False
                print("DRIP_END")
                # Send DRIP_END to server
                ws.send(json.dumps({"type": "DRIP_END"}))

            main_pos = int(drip_position)
            strip.setPixelColor(main_pos, Color(0, 150, 255))

            for i in range(1, TRAIL_LENGTH + 1):
                trail_pos = main_pos - i
                if trail_pos >= 0:
                    b = 150 - (i * 30)
                    if b > 0:
                        strip.setPixelColor(trail_pos, Color(0, b // 3, b))

        strip.show()
        time.sleep(0.05)

except KeyboardInterrupt:
    # Graceful shutdown
    for i in range(strip.numPixels()):
        strip.setPixelColor(i, 0)
    strip.show()
    print("Shutting down...")

