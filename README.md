# Dataview (name pending)
This project creates an IoT-like management system for a laboratory environment, allowing the remote monitoring and
management of multiple equipment through a web platform.

### Implementation Progress

##### High priority infrastructure
- [ ] Web interface
    - [ ] Welcome screen
    - [x] Devices screen
    - [x] Sensors screen
    - [ ] Experiments screen
- [x] Device drivers
    - [x] Device driver standardization
    - [x] Device driver loader
- [x] User to server WebSocket communication
- [ ] Dataflow based data processing
    - [x] Dataflow object
    - [x] Dataflow file structure
    - [ ] Server side dataflow processor (In progress :hourglass_flowing_sand:)
    - [x] Client side dataflow editor
    - [ ] Client to server dataflow exchange (In progress :hourglass_flowing_sand:)
    - [ ] Physical units for processed sensor data
- [ ] Graphs and other data display
    - [ ] Time x Variable graph
        - [ ] Scatter (In progress :hourglass_flowing_sand:)
        - [ ] Line
    - [ ] Variable x Variable graph
        - [ ] Scatter
        - [ ] Line
        - [ ] Bar
    - [ ] Sensor live raw data display (In progress :hourglass_flowing_sand:)
    - [ ] Non-linear axis
- [ ] User authentication
- [ ] Database backend for data storage

##### Future
- [ ] Advanced data processing
- [ ] Multiple dataflow data types (Only single precision floats are currently supported)
- [ ] Sensor value threshold notification
- [ ] Common serial API for device drivers
- [ ] Auto detection of derived physical unit