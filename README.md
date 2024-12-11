# Codeception Test Explorer

Test explorer for Codeception PHP testing framework.

## Features

- Run/Debug/Coverage tests from the Test Explorer UI
- Support for multiple test suites
- Automatic test discovery
- Support for custom Codeception configurations
- Nearest config file detection

## Coverage Features

The extension provides comprehensive code coverage support:

1. **Coverage View Integration**
   - Shows coverage data in VS Code's built-in Test Coverage view
   - Displays coverage statistics in the Test Explorer
   - Highlights covered and uncovered lines in the editor

2. **Coverage Configuration**

   ```json
   {
       "codeception.coverageArgs": [
           "--coverage",
           "--coverage-xml"
       ],
       "codeception.coverageHtmlFilePath": "tests/_output/coverage/index.html",
       "codeception.coverageXmlFilePath": "tests/_output/coverage.xml"
   }
   ```

   You can also configure the coverage path in your `codeception.yml`:

   ```yaml
   settings:
     coverage:
       report:
         html: 'custom/path/to/coverage'
   ```

3. **Coverage Requirements**
   - Xdebug must be installed and properly configured
   - PCOV or PHPDBG can also be used as alternatives
   - When using Docker, ensure your container has the necessary extensions

## Extension Settings

This extension contributes the following settings:

| Setting                            | Type       | Default                             | Description                                                                                                              |
| ---------------------------------- | ---------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `codeception.testFilePattern`      | `string`   | `**/*{Cest,Test}.php`               | Glob pattern to match test files                                                                                         |
| `codeception.configFilePattern`    | `string`   | `**/codeception*.{yml,yaml}`        | Glob pattern to match Codeception configuration files                                                                    |
| `codeception.codecept`             | `string`   | `vendor/bin/codecept`               | Path to Codeception binary (relative to workspace folder or absolute path)                                               |
| `codeception.args.additional`      | `string[]` | `["--no-colors", "--report"]`       | Additional arguments to pass to Codeception. Note: `--no-colors` and `--report` are required and will always be included |
| `codeception.args.debug`           | `string[]` | `["--debug"]`                       | Arguments to pass when running tests in debug mode                                                                       |
| `codeception.args.coverage`        | `string[]` | `["--coverage", "--coverage-html"]` | Arguments to pass when running tests with coverage                                                                       |
| `codeception.args.run`             | `string[]` | `[]`                                | Arguments to pass to the 'run' command (e.g., '-g' for specific groups)                                                  |
| `codeception.command.default`      | `string`   | `php`                               | Command to execute tests (e.g., 'php', 'docker exec container-name', or 'docker compose exec service-name')              |
| `codeception.command.debug`        | `string`   | `php`                               | Command to execute tests in debug mode                                                                                   |
| `codeception.useNearestConfigFile` | `boolean`  | `false`                             | Use nearest config file instead of the root config file                                                                  |
| `codeception.coverageHtmlFilePath` | `string`   | `tests/_output/coverage/index.html` | Path to store HTML coverage reports (relative to workspace folder)                                                       |
| `codeception.coverageXmlFilePath`  | `string`   | `tests/_output/coverage.xml`        | Path to store XML coverage reports (relative to workspace folder)                                                        |
| `codeception.pathMapping`          | `object`   | `{}`                                | Remote to local path mapping for coverage reports                                                                        |

## Configuration Examples

### Basic Configuration

```json
{
    "codeception.testFilePattern": "**/*{Cest,Test}.php",
    "codeception.codecept": "vendor/bin/codecept",
    "codeception.args.additional": [
        "--no-colors",
        "--report",
        "--other-arg"
    ]
}
```

### Docker Configuration

```json
{
    "codeception.command": "docker exec my-container",
    "codeception.debugCommand": "docker exec my-container",
    "codeception.args.additional": [
        "--no-colors",
        "--report",
        "-c",
        "custom/codeception.yml"
    ]
}
```

### Path Mapping for Remote Execution

```json
{
    "codeception.pathMapping": {
        "/var/www/html": "${workspaceFolder}"
    }
}
```

### Custom Coverage Path

```json
{
    "codeception.coverageHtmlFilePath": "custom/path/to/coverage/index.html",
    "codeception.coverageXmlFilePath": "custom/path/to/coverage.xml"
}
```

You can also configure the coverage path in your `codeception.yml`:

```yaml
settings:
  coverage:
    report:
      html: 'custom/path/to/coverage'
```

## Notes

- Coverage reports require Xdebug to be installed and properly configured
- When using Docker, make sure your container has the necessary PHP extensions installed
- The extension will automatically detect and use your project's `codeception.yml` configuration
- When `useNearestConfigFile` is enabled, the extension will search for the nearest config file relative to the test file

### Command Structure Notes

- The actual command structure is: `[COMMAND] [CODECEPT_PATH] RUN [RUN_ARGS] [TEST[:METHOD]] [DEBUG_ARGS] [COVERAGE_ARGS] [ADDITIONAL_ARGS] [-c CONFIG_PATH]`
- Debug mode uses `command.debug` instead of `command.default` when running tests with `debug` or `coverage`
- Config file path is always added last to ensure proper precedence
