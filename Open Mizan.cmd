@echo off
rem Opens Mizan in its own app window (no tabs, no address bar).
rem Keep this file in the same folder as index.html.
set "P=%~dp0index.html"
set "P=%P:\=/%"
start "" msedge --app="file:///%P%" --window-size=460,860
