# Codeception Test Explorer

Run Codeception tests natively from the Test explorer with code coverage support.

## Features

- Test Explorer integration for running and debugging Codeception tests
- Code coverage visualization with XML coverage reports
    - also check [coverage-gutters](https://marketplace.visualstudio.com/items?itemName=ryanluker.vscode-coverage-gutters) for coverage decorations
- Configurable test execution with custom commands
- Automatic test discovery for Cest and Test files
- Debug support with Xdebug integration
- Auto run debugger when running test in (debug/coverage) mode
- Group tests by `suites` or `directory` structure (configurable)
- Run individual tests cases or entire test classes
- Save test output with each test for future reference
- codelens to easily jump to test & back

## Coverage Features

- Tests are tagged with `coverage-{percentage}` for filtering
- Coverage data persists between sessions
- Coverage information is displayed in multiple ways:

    1. **Explorer View**:
        - Coverage percentage next each file

    2. **Editor**:
        - Coverage percentage at covered editor top left

    3. **Test Coverage View**:
        - Test items show coverage percentage in their description

## Requirements

- PHP 7.4 or higher
- Codeception 4.0 or higher
- Xdebug for debugging and coverage (optional)

## Usage

1. Open a workspace containing Codeception tests
2. Tests will be automatically discovered and displayed in the Test Explorer
3. Click the play button next to a test to run it
4. Click the debug button to run with debugger attached
5. Click the coverage button to run with debugger attached

### Docker Support

For Docker environments, configure path mapping to correctly resolve file paths:

```json
{
    "codeception.pathMapping": {
        "/var/www/html": "${workspaceFolder}"
    }
}
```
