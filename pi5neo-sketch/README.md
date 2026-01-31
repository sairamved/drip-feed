To run the project

1. Connect Neo Pixel Light Strip by the followings
- VIN -> 5V
- GND -> GND
- Signal -> GPIO18

2. Start the node server
```
cd pi5neo-sketch/
node server.js
```

3. Run the python script with the sudo permission
```
sudo dripfeedenv/bin/python3 led_service.py
```