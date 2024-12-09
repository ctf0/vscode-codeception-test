# Codeception Test Explorer

Test explorer for running Codeception PHP tests within VS Code's built-in Test Explorer UI.

## Features

- Run tests from the VS Code Test Explorer
- Debug tests with breakpoint support
- Generate and view code coverage data
- Automatically detect and load multiple test suites
- Support for nearest config file detection
- Support for both local and Docker environments

## Requirements

- PHP 7.0 or higher
- Codeception installed in project
- Xdebug (for debugging and coverage features)

## Docker Setup

```json
{
    "codeception.command.default": "docker exec my-container",
    "codeception.command.debug": "docker exec -e XDEBUG_SESSION=1 my-container",
    "codeception.pathMapping": {
        "/var/www/html": "${workspaceFolder}"
    }
}
```

## Notes

- The extension automatically detects your project's Codeception configuration
- Test discovery follows the patterns defined in your settings
- For Docker environments, ensure proper path mappings are configured
- Debug mode requires Xdebug to be properly configured
- Coverage reports require Xdebug with coverage enabled

## Todo

- [ ] add support to view coverage results in explorer and test view
