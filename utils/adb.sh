#!/bin/bash
adb kill-server
adb start-server
adb devices
adb reverse --remove-all
adb reverse tcp:8080 tcp:8080
