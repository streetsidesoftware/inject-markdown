<!--- @@inject: https://github.com/streetsidesoftware/inject-markdown/blob/bbb2c709c/src/FileSystemAdapter/fsa.ts#L26-L29 --->

```ts
async function fetchUrl(url: URL): Promise<string> {
  const response = await fetch(mapUrl(url));
  return await response.text();
}
```

<!--- @@inject-end: https://github.com/streetsidesoftware/inject-markdown/blob/bbb2c709c/src/FileSystemAdapter/fsa.ts#L26-L29 --->
