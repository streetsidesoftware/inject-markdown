# Example with embedded code

## TypeScript

<!--- @@inject: code.ts --->

```ts
export function sayHello(name: string): string {
  return `Hello ${name}`;
}
```

<!--- @@inject-end: code.ts --->

## JavaScript

<!--- @@inject: code.js --->

```js
export function sayHello(name) {
  return `Hello ${name}`;
}

export function sayGoodbye(name) {
  return `Goodbye ${name}`;
}
```

<!--- @@inject-end: code.js --->
