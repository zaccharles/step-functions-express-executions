let href: string;
let values: Record<string, unknown>;

export async function getAsync<T>(
  key: string,
  factory: () => Promise<T>,
  skipCache?: boolean
): Promise<T> {
  if (href !== window.location.href) {
    href = window.location.href;
    values = {};
  }

  if (!skipCache && Object.prototype.hasOwnProperty.call(values, key)) {
    return values[key] as T;
  }

  try {
    const value = await factory();
    if (value) values[key] = value;
    return value;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export function get<T>(key: string, factory: () => T, skipCache?: boolean): T {
  if (href !== window.location.href) {
    href = window.location.href;
    values = {};
  }

  if (!skipCache && Object.prototype.hasOwnProperty.call(values, key)) {
    return values[key] as T;
  }

  try {
    const value = factory();
    if (value) values[key] = value;
    return value;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// export function set(key: string, value: unknown) {
//   if (href !== window.location.href) {
//     href = window.location.href;
//     values = {};
//   }

//   values[key] = value;
// }
