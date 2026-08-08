export interface GreetingOptions {
  name?: string;
}

export function createGreeting(options: GreetingOptions = {}): string {
  const name = options.name?.trim() || "world";
  return `Hello, ${name}!`;
}
