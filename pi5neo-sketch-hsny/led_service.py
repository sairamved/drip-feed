import time
import websocket
import json
import math
from pi5neo import Pi5Neo

LED_COUNT = 12
TRAIL_LENGTH = 2

# ----- pi5neo setup -----
neo = Pi5Neo('/dev/spidev0.0', LED_COUNT, 800)

drip_position = 0.0
drip_active = False


def clear():
    for i in range(LED_COUNT):
        neo.set_led_color(i, 0, 0, 0)


def start_drip():
    global drip_position, drip_active
    if not drip_active:
        drip_position = 0.0
        drip_active = True


def update_drip(ws):
    global drip_position, drip_active

    if not drip_active:
        return

    # ----- Same easing as your Arduino -----
    progress = drip_position / (LED_COUNT - 1)
    eased = progress * progress

    drip_position += 0.25 + (eased * 2.0)

    if drip_position >= LED_COUNT - 1:
        drip_position = LED_COUNT - 1
        drip_active = False

        ws.send(json.dumps({
            "type": "DRIP_END"
        }))

    main = int(drip_position)

    clear()

    # Main drop color
    neo.set_led_color(main, 0, 150, 255)

    # Trail
    for i in range(1, TRAIL_LENGTH + 1):
        t = main - i
        if t >= 0:
            b = 150 - (i * 30)
            if b > 0:
                neo.set_led_color(t, 0, int(b/3), b)

    neo.update()


# ----- Websocket handlers -----

def on_message(ws, msg):
    data = json.loads(msg)

    if data["type"] == "TICK":
        start_drip()


ws = websocket.WebSocketApp(
    "ws://localhost:3000",
    on_message=on_message
)


def run():
    ws.run_forever()


if __name__ == "__main__":
    import threading

    # websocket thread
    t = threading.Thread(target=run)
    t.daemon = True
    t.start()

    # animation loop
    while True:
        update_drip(ws)
        time.sleep(0.05)
