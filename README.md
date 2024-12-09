# VS Code Codeception Test

A Visual Studio Code extension for running Codeception tests with integrated test explorer and code coverage support.

## Features

- Test Explorer integration for running and debugging Codeception tests
- Code coverage visualization with XML coverage reports
- Configurable test execution with custom commands
- Automatic test discovery for Cest and Test files
- Debug support with Xdebug integration

## Test Explorer Features

- Group tests by `suites` or `directory` structure (configurable)
- Run individual tests or entire test classes
- Debug tests with configurable debug commands
- View test results directly in the Test Explorer
- Coverage information displayed in test descriptions

## Coverage Features

### Commands

- `Codeception: Show Coverage Report` - Load and display coverage information in the editor
- `Codeception: Clear Coverage` - Clear coverage decorations from the editor

### Coverage Display

Coverage information is displayed in multiple ways:


1. **Test Explorer**:
   - Test items show coverage percentage in their description
   - Tests are tagged with `coverage-{percentage}` for filtering
   - Coverage data persists between sessions

2. **Test Coverage View**:
   - Test items show coverage percentage in their description
   - Tests are tagged with `coverage-{percentage}` for filtering
   - Coverage data persists between sessions

## Requirements

- PHP 7.4 or higher
- Codeception 4.0 or higher
- Xdebug for debugging and coverage (optional)

## Usage

1. Open a workspace containing Codeception tests
2. Tests will be automatically discovered and displayed in the Test Explorer
3. Click the play button next to a test to run it
4. Click the debug button to run with debugger attached
5. Use the coverage commands to view code coverage

### Coverage Usage

1. Coverage data is automatically loaded on extension startup if available
2. Run tests with coverage using the Coverage profile in Test Explorer
3. Use `Codeception: Show Coverage Report` to display coverage information
4. Use `Codeception: Clear Coverage` to remove coverage decorations

### Docker Support

For Docker environments, configure path mapping to correctly resolve file paths:

```jsonc
{
    "codeception.pathMapping": {
        "/var/www/html": "${workspaceFolder}"
    }
}
```
