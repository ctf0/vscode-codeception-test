# Codeception Test Explorer

Test explorer for Codeception PHP testing framework.

## Features

- Run/Debug/Coverage tests from the Test Explorer UI
- Support for multiple test suites
- Automatic test discovery
- Support for custom Codeception configurations

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

4. **Environment Variables**
   For coverage to work with Xdebug, you need to set the appropriate mode:

   ```json
   {
       "codeception.env": {
           "XDEBUG_MODE": "coverage"
       }
   }
   ```

## Extension Settings

This extension contributes the following settings:

| Setting                            | Type       | Default                             | Description                                                                                                              |
| ---------------------------------- | ---------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `codeception.testFilePattern`      | `string`   | `**/*{Cest,Test}.php`               | Glob pattern to match test files                                                                                         |
| `codeception.codecept`             | `string`   | `vendor/bin/codecept`               | Path to Codeception binary (relative to workspace folder or absolute path)                                               |
| `codeception.args.additional`      | `string[]` | `["--no-colors", "--report"]`       | Additional arguments to pass to Codeception. Note: `--no-colors` and `--report` are required and will always be included |
| `codeception.args.debug`           | `string[]` | `["--debug"]`                       | Arguments to pass when running tests in debug mode                                                                       |
| `codeception.args.coverage`        | `string[]` | `["--coverage", "--coverage-html"]` | Arguments to pass when running tests with coverage                                                                       |
| `codeception.args.run`             | `string[]` | `[]`                                | Arguments to pass to the 'run' command (e.g., '-g' for specific groups)                                                  |
| `codeception.command`              | `string`   | `php`                               | Command to execute tests (e.g., 'php', 'docker exec container-name', or 'docker compose exec service-name')              |
| `codeception.debugCommand`         | `string`   | `php`                               | Command to execute tests in debug mode                                                                                   |
| `codeception.useNearestConfigFile` | `boolean`  | `false`                             | Use nearest config file instead of the root config file                                                                  |
| `codeception.env`                  | `object`   | `{}`                                | Environment variables to set when running tests, e.g. `{"XDEBUG_MODE": "coverage"}`                                      |
| `codeception.coverageHtmlFilePath` | `string`   | `tests/_output/coverage/index.html` | Path to store coverage reports (relative to workspace folder)                                                            |

## Configuration Examples

### Basic Configuration

```json
{
    "codeception.testFilePattern": "**/*{Cest,Test}.php",
    "codeception.codecept": "vendor/bin/codecept",
    "codeception.additionalArgs": [
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
    "codeception.debugCommand": "docker exec -e XDEBUG_MODE=debug my-container",
    "codeception.env": {
        "XDEBUG_MODE": "coverage"
    },
    "codeception.additionalArgs": [
        "--no-colors",
        "--report",
        "-c",
        "custom/codeception.yml"
    ]
}
```

### Custom Coverage Path

```json
{
    "codeception.coverageHtmlFilePath": "custom/path/to/coverage"
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

### Command Structure Notes

- The actual command structure is: `[ENV_VARS] [COMMAND] [CODECEPT_PATH] RUN [RUN_ARGS] [TEST[:METHOD]] [DEBUG_ARGS] [COVERAGE_ARGS] [ADDITIONAL_ARGS]`
- Debug mode uses `debugCommand` instead of `command` when running tests with `debug` or `coverage`
- If you specify `-c` or `-config` in `additionalArgs`, the automatic config file path will be skipped
