# Security Vulnerability Patterns

Quick reference for common security issues across languages.

## OWASP Top 10 Quick Checks

### 1. Injection Attacks

**SQL Injection**

```sql
-- ❌ String concatenation
query = "SELECT * FROM users WHERE id = " + user_id

-- ✅ Parameterized query
query = "SELECT * FROM users WHERE id = ?"
execute(query, [user_id])
```

**Command Injection**

```python
# ❌ Shell=True with user input
subprocess.call(f"ping {host}", shell=True)

# ✅ No shell, list of args
subprocess.call(["ping", host])
```

**LDAP Injection**

```java
// ❌ Unescaped user input
String filter = "(uid=" + username + ")";

// ✅ Escaped input
String filter = "(uid=" + escapeLDAPSearchFilter(username) + ")";
```

### 2. Broken Authentication

**Weak Password Storage**

```python
# ❌ Plain text or weak hash
password_hash = hashlib.md5(password).hexdigest()

# ✅ Strong algorithm with salt
password_hash = bcrypt.hashpw(password, bcrypt.gensalt())
```

**Session Fixation**

```javascript
// ❌ Reusing session after login
app.post('/login', (req, res) => {
    // Same session ID continues
});

// ✅ Regenerate session
app.post('/login', (req, res) => {
    req.session.regenerate(() => {
        req.session.userId = user.id;
    });
});
```

**Missing Rate Limiting**

```python
# ❌ No protection against brute force
@app.route('/login', methods=['POST'])
def login():
    if check_password(username, password):
        return success()

# ✅ Rate limited
@limiter.limit("5 per minute")
@app.route('/login', methods=['POST'])
def login():
    if check_password(username, password):
        return success()
```

### 3. Sensitive Data Exposure

**Hardcoded Secrets**

```javascript
// ❌ Secret in code
const apiKey = "sk_live_abc123";

// ✅ Environment variable
const apiKey = process.env.API_KEY;
```

**Logging Sensitive Data**

```python
# ❌ Logs password
logger.info(f"Login attempt: {username}, {password}")

# ✅ No sensitive data
logger.info(f"Login attempt for user: {username}")
```

**Weak Encryption**

```python
# ❌ Weak or ECB mode
cipher = AES.new(key, AES.MODE_ECB)

# ✅ Strong mode with authentication
cipher = AES.new(key, AES.MODE_GCM)
```

### 4. XML External Entities (XXE)

```python
# ❌ Vulnerable to XXE
parser = etree.XMLParser()
doc = etree.parse(xml_input, parser)

# ✅ Disable external entities
parser = etree.XMLParser(resolve_entities=False)
doc = etree.parse(xml_input, parser)
```

### 5. Broken Access Control

**Missing Authorization**

```javascript
// ❌ No ownership check
app.delete('/posts/:id', (req, res) => {
    Post.delete(req.params.id);
});

// ✅ Verify ownership
app.delete('/posts/:id', (req, res) => {
    const post = Post.find(req.params.id);
    if (post.userId !== req.user.id) {
        return res.status(403).send('Forbidden');
    }
    post.delete();
});
```

**Insecure Direct Object Reference (IDOR)**

```python
# ❌ Any user can access any record
@app.route('/user/<user_id>/profile')
def profile(user_id):
    return User.query.get(user_id)

# ✅ Check authorization
@app.route('/user/<user_id>/profile')
def profile(user_id):
    if current_user.id != user_id and not current_user.is_admin:
        abort(403)
    return User.query.get(user_id)
```

### 6. Security Misconfiguration

**Debug Mode in Production**

```python
# ❌ Debug enabled
app.run(debug=True)

# ✅ Debug only in development
app.run(debug=os.getenv('ENV') == 'development')
```

**Default Credentials**

```javascript
// ❌ Default admin password
const adminPassword = "admin123";

// ✅ Force password change on first login
const adminPassword = generateSecurePassword();
requirePasswordChange(admin);
```

**Verbose Error Messages**

```python
# ❌ Exposes internal details
except Exception as e:
    return jsonify({"error": str(e), "traceback": traceback.format_exc()})

# ✅ Generic error for users
except Exception as e:
    logger.error(f"Error: {e}", exc_info=True)
    return jsonify({"error": "An error occurred"}), 500
```

### 7. Cross-Site Scripting (XSS)

**Reflected XSS**

```javascript
// ❌ Unsanitized output
res.send(`Hello ${req.query.name}`);

// ✅ Escaped output
res.send(`Hello ${escapeHtml(req.query.name)}`);
```

**Stored XSS**

```javascript
// ❌ Dangerous HTML insertion
element.innerHTML = userComment;

// ✅ Safe text insertion
element.textContent = userComment;

// ✅ Or sanitize if HTML needed
element.innerHTML = DOMPurify.sanitize(userComment);
```

**DOM-based XSS**

```javascript
// ❌ Direct DOM manipulation
document.write(location.hash.substring(1));

// ✅ Safe manipulation
const text = document.createTextNode(location.hash.substring(1));
element.appendChild(text);
```

### 8. Insecure Deserialization

```python
# ❌ Arbitrary code execution
import pickle
data = pickle.loads(untrusted_input)

# ✅ Use safe format
import json
data = json.loads(untrusted_input)
```

```java
// ❌ Unsafe deserialization
ObjectInputStream ois = new ObjectInputStream(inputStream);
Object obj = ois.readObject();

// ✅ Validate class before deserializing
ObjectInputStream ois = new ValidatingObjectInputStream(inputStream);
ois.setAcceptedClasses(SafeClass.class);
```

### 9. Using Components with Known Vulnerabilities

**Outdated Dependencies**

```json
// ❌ Old version with known CVEs
{
  "dependencies": {
    "lodash": "4.17.10"  // Has prototype pollution
  }
}

// ✅ Updated version
{
  "dependencies": {
    "lodash": "4.17.21"
  }
}
```

**Check with tools:**

- npm audit
- pip-audit
- OWASP Dependency-Check
- Snyk

### 10. Insufficient Logging & Monitoring

```python
# ❌ No audit trail
def delete_user(user_id):
    User.query.filter_by(id=user_id).delete()

# ✅ Log security events
def delete_user(user_id):
    user = User.query.get(user_id)
    audit_logger.info(f"User {current_user.id} deleted user {user_id}")
    user.delete()
```

## Additional Security Patterns

### CSRF Protection

```javascript
// ❌ No CSRF token
app.post('/transfer', (req, res) => {
    transferMoney(req.body.to, req.body.amount);
});

// ✅ CSRF token validation
app.use(csrf());
app.post('/transfer', (req, res) => {
    // Token automatically validated by middleware
    transferMoney(req.body.to, req.body.amount);
});
```

### Path Traversal

```python
# ❌ Unrestricted file access
filename = request.args.get('file')
with open(f"/uploads/{filename}") as f:
    return f.read()

# ✅ Validate path stays in directory
from pathlib import Path
base = Path("/uploads").resolve()
filepath = (base / filename).resolve()
if not filepath.is_relative_to(base):
    abort(400)
with open(filepath) as f:
    return f.read()
```

### Server-Side Request Forgery (SSRF)

```python
# ❌ Unrestricted URL fetching
url = request.args.get('url')
response = requests.get(url)

# ✅ Whitelist allowed domains
from urllib.parse import urlparse
allowed_domains = ['api.example.com']
parsed = urlparse(url)
if parsed.netloc not in allowed_domains:
    abort(400, "Invalid domain")
response = requests.get(url)
```

### Timing Attacks

```python
# ❌ Timing attack vulnerable
def verify_token(user_token, valid_token):
    return user_token == valid_token  # Early exit reveals info

# ✅ Constant-time comparison
import hmac
def verify_token(user_token, valid_token):
    return hmac.compare_digest(user_token, valid_token)
```

### Mass Assignment

```python
# ❌ Allows setting any field
user.update(**request.json)

# ✅ Whitelist allowed fields
allowed_fields = ['name', 'email', 'bio']
updates = {k: v for k, v in request.json.items() if k in allowed_fields}
user.update(**updates)
```

## Quick Security Checklist

- [ ] Input validation on all user inputs
- [ ] Parameterized queries for SQL
- [ ] Output encoding for HTML/JavaScript
- [ ] Authentication on sensitive endpoints
- [ ] Authorization checks for resource access
- [ ] HTTPS for all sensitive data
- [ ] Secure password hashing (bcrypt, argon2)
- [ ] CSRF tokens on state-changing operations
- [ ] Rate limiting on authentication endpoints
- [ ] No secrets in code or logs
- [ ] Security headers configured
- [ ] Dependencies up to date
- [ ] Error messages don't expose internals
