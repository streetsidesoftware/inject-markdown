# Template variables — CLI/environment sources

## CLI --value

<!--- @@inject-code: cli-value.txt#vars --->

```
Value: {@ fromCli @}
```

<!--- @@inject-end: cli-value.txt#vars --->

## CLI --values-file

<!--- @@inject-code: cli-values-file.txt#vars --->

```
Town: {@ cliData.town @}
```

<!--- @@inject-end: cli-values-file.txt#vars --->

## Environment (--allow-env)

<!--- @@inject-code: env-ref.txt#vars --->

```
Env: {@ env.TV_TEST_VAR @}
```

<!--- @@inject-end: env-ref.txt#vars --->

## Directive inline values takes precedence over CLI --value

<!--- @@inject-code: override.txt#values=greeting:Directive&vars --->

```
Greeting: Directive
```

<!--- @@inject-end: override.txt#values=greeting:Directive&vars --->
