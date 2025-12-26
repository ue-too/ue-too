# JavaScript/TypeScript Code Review Checklist

## JavaScript/TypeScript Specific Issues

### Type Safety (TypeScript)

**Avoid `any`**
```typescript
// ❌ Loses all type safety
function process(data: any) { }

// ✅ Use proper types
function process(data: UserData) { }

// ✅ Or use generics
function process<T extends Record<string, unknown>>(data: T) { }
```

**Avoid type assertions without good reason**
```typescript
// ❌ Unsafe assertion
const user = data as User;

// ✅ Validate first
if (isUser(data)) {
  const user = data;
}
```

**Don't use non-null assertion carelessly**
```typescript
// ❌ Could crash
const name = user!.profile!.name;

// ✅ Use optional chaining
const name = user?.profile?.name;
```

### Async/Await

**Don't forget await**
```typescript
// ❌ Returns Promise, doesn't wait
async function getData() {
  const result = fetchData(); // Missing await!
  return result;
}

// ✅ Actually waits
async function getData() {
  const result = await fetchData();
  return result;
}
```

**Don't mix callbacks and promises**
```typescript
// ❌ Confusing mix
function loadData(callback) {
  return fetch('/api/data')
    .then(r => r.json())
    .then(data => callback(null, data));
}

// ✅ Pick one approach
async function loadData() {
  const response = await fetch('/api/data');
  return response.json();
}
```

**Handle promise rejections**
```typescript
// ❌ Unhandled rejection
async function main() {
  await riskyOperation();
}

// ✅ Handle errors
async function main() {
  try {
    await riskyOperation();
  } catch (error) {
    logger.error('Operation failed', error);
    throw error;
  }
}
```

### Common Pitfalls

**== vs ===**
```typescript
// ❌ Type coercion surprises
if (x == null) { } // Matches null AND undefined
if ('' == 0) { }    // true!

// ✅ Explicit comparison
if (x === null || x === undefined) { }
if (x === 0) { }
```

**Variable scoping with var**
```typescript
// ❌ Function-scoped, hoisted
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i)); // Prints 3, 3, 3
}

// ✅ Block-scoped
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i)); // Prints 0, 1, 2
}
```

**Array mutation**
```typescript
// ❌ Mutates original
function addItem(items, item) {
  items.push(item);
  return items;
}

// ✅ Returns new array
function addItem(items, item) {
  return [...items, item];
}
```

**Object property access**
```typescript
// ❌ Can crash if user is null
const name = user.name;

// ✅ Safe access
const name = user?.name;

// ✅ With default
const name = user?.name ?? 'Anonymous';
```

### Performance

**Avoid unnecessary re-renders (React)**
```typescript
// ❌ Creates new object every render
<Component config={{ theme: 'dark' }} />

// ✅ Memoize or move outside
const CONFIG = { theme: 'dark' };
<Component config={CONFIG} />
```

**Debounce expensive operations**
```typescript
// ❌ Fires on every keystroke
<input onChange={(e) => searchAPI(e.target.value)} />

// ✅ Debounced
const debouncedSearch = debounce(searchAPI, 300);
<input onChange={(e) => debouncedSearch(e.target.value)} />
```

**Avoid array methods in loops**
```typescript
// ❌ O(n²) complexity
for (const item of items) {
  if (validIds.includes(item.id)) { // includes is O(n)
    // ...
  }
}

// ✅ O(n) with Set
const validIdSet = new Set(validIds);
for (const item of items) {
  if (validIdSet.has(item.id)) { // O(1) lookup
    // ...
  }
}
```

### Security

**Avoid eval and Function constructor**
```typescript
// ❌ Dangerous code execution
eval(userInput);
new Function(userInput)();

// ✅ Use safer alternatives
JSON.parse(userInput); // For data only
```

**Sanitize HTML**
```typescript
// ❌ XSS vulnerability
div.innerHTML = userInput;

// ✅ Safe text insertion
div.textContent = userInput;

// ✅ Or use DOMPurify for HTML
div.innerHTML = DOMPurify.sanitize(userInput);
```

**Don't trust client-side validation**
```typescript
// ❌ Client-side only
function submitForm(data) {
  if (isValid(data)) {
    api.post('/submit', data);
  }
}

// ✅ Server validates too
// Client: validate for UX
// Server: validate for security
```

### Memory Leaks

**Clean up event listeners**
```typescript
// ❌ Listener persists after component unmount
useEffect(() => {
  window.addEventListener('resize', handleResize);
}, []);

// ✅ Clean up
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

**Clear timers**
```typescript
// ❌ Timer continues after component unmount
useEffect(() => {
  setInterval(() => updateData(), 1000);
}, []);

// ✅ Clear on cleanup
useEffect(() => {
  const timer = setInterval(() => updateData(), 1000);
  return () => clearInterval(timer);
}, []);
```

### Best Practices

**Use optional chaining**
```typescript
// ❌ Verbose and error-prone
const city = user && user.address && user.address.city;

// ✅ Concise and safe
const city = user?.address?.city;
```

**Use nullish coalescing**
```typescript
// ❌ 0, '', false treated as missing
const count = value || 10; // 0 becomes 10!

// ✅ Only null/undefined treated as missing
const count = value ?? 10; // 0 stays 0
```

**Prefer const for objects and arrays**
```typescript
// ❌ Can be reassigned
let config = { theme: 'dark' };
config = { theme: 'light' }; // Allowed

// ✅ Reference is const (contents can change)
const config = { theme: 'dark' };
config.theme = 'light'; // OK
config = {}; // Error
```

**Use template literals**
```typescript
// ❌ Hard to read
const msg = 'Hello ' + name + ', you have ' + count + ' messages';

// ✅ Clear and readable
const msg = `Hello ${name}, you have ${count} messages`;
```

### Testing Red Flags

**Missing error case tests**
```typescript
// ❌ Only happy path
test('fetches user', async () => {
  const user = await fetchUser('123');
  expect(user.name).toBe('Alice');
});

// ✅ Test errors too
test('handles fetch errors', async () => {
  mockFetch.mockRejectedValue(new Error('Network error'));
  await expect(fetchUser('123')).rejects.toThrow('Network error');
});
```

**Brittle snapshot tests**
```typescript
// ❌ Breaks on any change
expect(component).toMatchSnapshot();

// ✅ Test specific behavior
expect(component.find('button')).toHaveLength(1);
expect(component.find('.error')).toHaveText('Invalid input');
```
