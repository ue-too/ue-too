# Python Code Review Checklist

## Python Specific Issues

### Resource Management

**Always use context managers**

```python
# ❌ File might not be closed
f = open('file.txt')
data = f.read()
f.close()

# ✅ Automatically closed
with open('file.txt') as f:
    data = f.read()
```

**Database connections**

```python
# ❌ Connection leak
conn = get_db_connection()
cursor = conn.cursor()
cursor.execute(query)

# ✅ Properly managed
with get_db_connection() as conn:
    with conn.cursor() as cursor:
        cursor.execute(query)
```

### Common Pitfalls

**Mutable default arguments**

```python
# ❌ Default list is shared across calls!
def add_item(item, items=[]):
    items.append(item)
    return items

# ✅ Use None as default
def add_item(item, items=None):
    if items is None:
        items = []
    items.append(item)
    return items
```

**Late binding in closures**

```python
# ❌ All functions reference same 'i'
funcs = [lambda: i for i in range(3)]
[f() for f in funcs]  # [2, 2, 2]

# ✅ Capture value
funcs = [lambda x=i: x for i in range(3)]
[f() for f in funcs]  # [0, 1, 2]
```

**String concatenation in loops**

```python
# ❌ O(n²) - strings are immutable
result = ""
for item in items:
    result += str(item)

# ✅ O(n) - use join
result = "".join(str(item) for item in items)
```

**Exception handling anti-patterns**

```python
# ❌ Catches everything, even KeyboardInterrupt
try:
    risky_operation()
except:
    pass

# ✅ Catch specific exceptions
try:
    risky_operation()
except ValueError as e:
    logger.error(f"Invalid value: {e}")
```

### Type Hints

**Use type hints for function signatures**

```python
# ❌ No type information
def process(data, limit):
    return data[:limit]

# ✅ Clear types
def process(data: list[str], limit: int) -> list[str]:
    return data[:limit]
```

**Use Optional for nullable values**

```python
# ❌ Ambiguous
def find_user(user_id: int) -> User:
    # What if not found?

# ✅ Explicit
def find_user(user_id: int) -> User | None:
    # Caller knows it can be None
```

**Type hint complex structures**

```python
# ❌ Generic dict loses information
def process(config: dict) -> dict:
    pass

# ✅ Specific types
from typing import TypedDict

class Config(TypedDict):
    host: str
    port: int
    timeout: float

def process(config: Config) -> dict[str, Any]:
    pass
```

### Performance

**Use list comprehensions appropriately**

```python
# ❌ Slower
result = []
for item in items:
    result.append(item * 2)

# ✅ Faster and more readable
result = [item * 2 for item in items]

# ❌ Don't use for side effects
[print(item) for item in items]  # Bad!

# ✅ Use regular loop for side effects
for item in items:
    print(item)
```

**Use generators for large datasets**

```python
# ❌ Loads everything into memory
def get_records():
    return [process(line) for line in huge_file]

# ✅ Processes one at a time
def get_records():
    for line in huge_file:
        yield process(line)
```

**Use appropriate data structures**

```python
# ❌ O(n) lookups
if item in items_list:  # Slow for large lists

# ✅ O(1) lookups
if item in items_set:  # Fast

# ❌ Checking existence then accessing
if key in dict_obj:
    value = dict_obj[key]

# ✅ Use get() or try/except
value = dict_obj.get(key, default)
```

### Security

**SQL Injection**

```python
# ❌ Vulnerable to SQL injection
query = f"SELECT * FROM users WHERE id = {user_id}"
cursor.execute(query)

# ✅ Use parameterized queries
query = "SELECT * FROM users WHERE id = ?"
cursor.execute(query, (user_id,))
```

**Command Injection**

```python
# ❌ Shell injection risk
import os
os.system(f"rm {filename}")

# ✅ Use subprocess with list
import subprocess
subprocess.run(["rm", filename], check=True)
```

**Pickle security**

```python
# ❌ Arbitrary code execution risk
import pickle
data = pickle.loads(untrusted_input)

# ✅ Use JSON for untrusted data
import json
data = json.loads(untrusted_input)
```

**Path traversal**

```python
# ❌ Can access any file
with open(f"/uploads/{user_filename}") as f:
    content = f.read()

# ✅ Validate path
from pathlib import Path

base_dir = Path("/uploads").resolve()
file_path = (base_dir / user_filename).resolve()

if not file_path.is_relative_to(base_dir):
    raise ValueError("Invalid path")
```

### Best Practices

**Follow PEP 8**

```python
# ❌ Poor naming
def fn(x,y):
    return x+y

# ✅ Clear naming and spacing
def calculate_sum(first_number: int, second_number: int) -> int:
    return first_number + second_number
```

**Use enumerate instead of range(len())**

```python
# ❌ Verbose and error-prone
for i in range(len(items)):
    print(i, items[i])

# ✅ Pythonic
for i, item in enumerate(items):
    print(i, item)
```

**Use zip for parallel iteration**

```python
# ❌ Manual indexing
for i in range(len(names)):
    print(names[i], ages[i])

# ✅ Clean iteration
for name, age in zip(names, ages):
    print(name, age)
```

**Use dictionary get() with defaults**

```python
# ❌ Verbose
if key in config:
    value = config[key]
else:
    value = default_value

# ✅ Concise
value = config.get(key, default_value)
```

**Use 'is' for None checks**

```python
# ❌ Uses __eq__
if value == None:
    pass

# ✅ Identity check
if value is None:
    pass
```

**Avoid bare except**

```python
# ❌ Catches system exits, keyboard interrupt
try:
    operation()
except:
    handle_error()

# ✅ Catch specific exceptions
try:
    operation()
except (ValueError, KeyError) as e:
    handle_error(e)
```

### Async/Await

**Don't forget await**

```python
# ❌ Returns coroutine, doesn't execute
async def get_data():
    result = fetch_data()  # Missing await!
    return result

# ✅ Actually awaits
async def get_data():
    result = await fetch_data()
    return result
```

**Use asyncio.gather for parallel tasks**

```python
# ❌ Sequential, slow
async def fetch_all():
    user = await fetch_user()
    posts = await fetch_posts()
    comments = await fetch_comments()
    return user, posts, comments

# ✅ Parallel, fast
async def fetch_all():
    results = await asyncio.gather(
        fetch_user(),
        fetch_posts(),
        fetch_comments()
    )
    return results
```

### Django/Flask Specific

**Django QuerySet optimization**

```python
# ❌ N+1 queries
for user in User.objects.all():
    print(user.profile.bio)  # Extra query per user

# ✅ Prefetch related
for user in User.objects.select_related('profile'):
    print(user.profile.bio)
```

**Flask request handling**

```python
# ❌ No validation
@app.route('/user/<user_id>')
def get_user(user_id):
    user = User.query.get(user_id)
    return jsonify(user)

# ✅ Validate and handle errors
@app.route('/user/<int:user_id>')
def get_user(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict())
```

### Testing

**Use fixtures properly**

```python
# ❌ Setup in every test
def test_user_creation():
    db.create_all()
    user = User(name="Alice")
    db.session.add(user)
    db.session.commit()

# ✅ Use fixture
@pytest.fixture
def db_session():
    db.create_all()
    yield db.session
    db.drop_all()

def test_user_creation(db_session):
    user = User(name="Alice")
    db_session.add(user)
    db_session.commit()
```

**Test exceptions properly**

```python
# ❌ Doesn't verify exception
def test_error():
    try:
        risky_function()
        assert False, "Should have raised"
    except ValueError:
        pass

# ✅ Use pytest.raises
def test_error():
    with pytest.raises(ValueError, match="Invalid value"):
        risky_function()
```
