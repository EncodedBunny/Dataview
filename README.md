# Dataview (name pending)
This project creates an IoT-like management system for a laboratory environment, allowing the remote monitoring and
management of multiple equipment through a web platform.

### Implementation Progress

##### High priority infrastructure
- [ ] Web interface
    - [ ] Welcome screen
    - [x] Devices screen
    - [x] Sensors screen
    - [x] Experiments screen
    - [ ] Settings screen (In progress :hourglass_flowing_sand:)
- [ ] JSON form specifier
    - [x] Basic form functionality
    - [ ] Events
    - [ ] More input types
- [x] Device drivers
    - [x] Device driver standardization
    - [x] Device driver loader
- [x] User to server WebSocket communication
- [ ] Dataflow based data processing
    - [x] Dataflow object
    - [x] Dataflow file structure
    - [x] Server side dataflow processor
    - [x] Client side dataflow editor
    - [x] Client to server dataflow exchange
    - [ ] Physical units for processed sensor data
    - [ ] Logic flow control (In progress :hourglass_flowing_sand:)
    - [ ] Output nodes (In progress :hourglass_flowing_sand:)
- [ ] Graphs and other data display
    - [ ] Variable x Variable graph
        - [ ] Scatter
        - [x] Line
        - [ ] Bar
    - [ ] Sensor live raw data display
    - [ ] Non-linear axis
- [ ] User authentication
- [ ] Database backend for data storage

##### Future
- [ ] Advanced data processing
- [ ] Multiple dataflow data types (Only single precision floats are currently supported)
- [ ] Sensor value threshold notification
- [ ] Common serial API for device drivers
- [ ] Auto detection of derived physical unit