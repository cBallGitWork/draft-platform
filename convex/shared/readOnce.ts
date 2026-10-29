/** `read`, each key read once however many ask for it, at once or later: the first call's promise
 *  is kept and handed to every caller of that key, so a read that rejects rejects every one. */
export function readOnce<K, V>(read: (key: K) => Promise<V>): (key: K) => Promise<V> {
  const held = new Map<K, Promise<V>>();
  return (key) => {
    let value = held.get(key);
    if (value === undefined) {
      value = read(key);
      held.set(key, value);
    }
    return value;
  };
}
