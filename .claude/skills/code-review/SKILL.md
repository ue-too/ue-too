---
name: code-review
description: Perform thorough code reviews with focus on security, performance, maintainability, and best practices. Use when reviewing code changes, pull requests, entire files, or codebase audits across any programming language.
---

# Code Review Skill

## Overview

This skill provides a structured approach to code reviews, covering security vulnerabilities, performance issues, code quality, maintainability, and best practices across multiple programming languages.

## Review Approach Decision Tree

**Choose review depth based on request:**

1. **Quick review / sanity check** → Use Quick Review Checklist (5-10 items)
2. **Standard PR review** → Use Standard Review (security, performance, maintainability)
3. **Comprehensive audit** → Use Deep Review (all categories + architecture)
4. **Specific focus** (e.g., "check security") → Use relevant focused section

**Default to Standard Review unless otherwise specified.**

## Review Structure

Organize findings by severity and category:

### Severity Levels

**🔴 Critical** - Must fix before merge

- Security vulnerabilities
- Data loss risks
- Breaking changes
- Critical bugs

**🟡 Important** - Should fix soon

- Performance issues
- Poor error handling
- Maintainability concerns
- API design problems

**🔵 Minor** - Nice to have

- Style inconsistencies
- Documentation gaps
- Minor optimizations
- Suggestion for refactoring

**✅ Positive** - What's done well

- Good patterns used
- Clever solutions
- Solid error handling
- Well-structured code

## Standard Review Checklist

### 1. Security

**Authentication & Authorization**

- Are authentication checks present and correct?
- Is authorization enforced at the right level?
- Are user permissions validated before sensitive operations?

**Input Validation**

- Is all user input validated and sanitized?
- Are there SQL injection risks? (Check raw queries, string concatenation)
- Are there XSS vulnerabilities? (Check unescaped output)
- Are file uploads validated properly? (Type, size, content)

**Sensitive Data**

- Are secrets/API keys hardcoded? (Should use environment variables)
- Is sensitive data logged inappropriately?
- Are passwords hashed properly? (bcrypt, argon2, not MD5/SHA1)
- Is PII (Personally Identifiable Information) handled correctly?

**Common Vulnerabilities**

- Path traversal: `../../../etc/passwd`
- Command injection: Unescaped shell commands
- Deserialization: Unsafe pickle/eval/JSON parsing
- CSRF: Missing CSRF tokens on state-changing operations
- Timing attacks: Non-constant-time comparisons for secrets

### 2. Performance

**Algorithmic Complexity**

- Are there O(n²) or worse algorithms where O(n log n) or O(n) would work?
- Nested loops over large datasets?
- Inefficient string concatenation in loops?

**Database Queries**

- N+1 query problems? (Load related data in single query)
- Missing indexes on frequently queried columns?
- SELECT \* when only specific columns needed?
- Queries inside loops?

**Resource Management**

- Are files/connections/streams properly closed?
- Memory leaks? (Event listeners not cleaned up, circular references)
- Large objects kept in memory unnecessarily?

**Caching Opportunities**

- Repeated expensive computations that could be cached?
- API calls that could be batched or memoized?
- Static data fetched on every request?

### 3. Error Handling

**Exception Handling**

- Are exceptions caught at the right level?
- Are errors logged with sufficient context?
- Are generic catch-all blocks hiding specific errors?
- Are custom errors informative?

**Edge Cases**

- Null/undefined checks where needed?
- Empty array/collection handling?
- Division by zero checks?
- Boundary conditions tested?

**User-Facing Errors**

- Are error messages helpful but not exposing internals?
- Are errors returned with appropriate HTTP status codes?
- Is there graceful degradation when services fail?

### 4. Code Quality

**Readability**

- Are variable/function names clear and descriptive?
- Is the code self-documenting or does it need comments?
- Are functions doing one thing (Single Responsibility)?
- Is nesting depth reasonable (< 4 levels)?

**Maintainability**

- Are magic numbers/strings extracted to named constants?
- Is there duplicated code that should be DRYed?
- Are functions too long (>50 lines is a smell)?
- Is coupling loose and cohesion high?

**Testing**

- Are there tests for the new/changed code?
- Are edge cases covered?
- Are tests meaningful or just achieving coverage?
- Are integration points tested?

### 5. Best Practices (Language-Specific)

**JavaScript/TypeScript**

- Using const/let instead of var?
- Avoiding == in favor of ===?
- Proper async/await usage (not missing await)?
- TypeScript types comprehensive and not using `any` excessively?

**Python**

- Following PEP 8 style guidelines?
- Using context managers (with statement) for resources?
- Proper use of list comprehensions vs loops?
- Type hints for function signatures?

**Go**

- Errors checked and not ignored?
- Defer used for cleanup?
- Interfaces kept small?
- Goroutines have proper lifecycle management?

**Java**

- Resources in try-with-resources?
- Using appropriate collection types?
- Avoiding primitive obsession?
- Proper exception hierarchy?

**Rust**

- Proper error propagation with `?` operator?
- Ownership and borrowing used correctly?
- No unnecessary clones?
- Unsafe blocks justified and minimal?

**Web Graphics (Canvas/WebGL/WebGPU)**

- Draw calls batched and minimized?
- Texture atlases used instead of individual textures?
- Shaders optimized (precision, conditionals, uniform updates)?
- Resources properly disposed (textures, buffers)?
- Heavy computation offloaded to workers or WASM?
- Object pooling for frequently created objects?
- See `references/web-graphics-performance.md` for detailed patterns

## Deep Review (Comprehensive Audit)

Include everything from Standard Review plus:

### Architecture & Design

**Design Patterns**

- Are appropriate design patterns used?
- Are patterns over-engineered for the problem?
- Is there clear separation of concerns?

**Dependencies**

- Are dependencies up-to-date and secure?
- Are heavy dependencies justified?
- Is the dependency graph reasonable?

**API Design**

- Are API contracts clear and versioned?
- Is the API consistent with existing patterns?
- Are breaking changes properly communicated?

### Code Organization

**Project Structure**

- Are files organized logically?
- Is code grouped by feature or layer appropriately?
- Are module boundaries clear?

**Configuration**

- Is configuration externalized?
- Are environment-specific configs handled properly?
- Are defaults sensible?

### Documentation

**Code Documentation**

- Are complex algorithms explained?
- Are public APIs documented?
- Are assumptions stated?

**README & Guides**

- Is setup documentation current?
- Are examples provided?
- Are breaking changes noted?

## Quick Review Checklist

For rapid feedback (use when time is limited):

1. **Security**: Any obvious vulnerabilities?
2. **Correctness**: Does the logic look sound?
3. **Edge cases**: Null checks, empty arrays, boundary conditions?
4. **Performance**: Any obvious inefficiencies?
5. **Error handling**: Are errors caught and handled?
6. **Readability**: Is the code easy to understand?
7. **Tests**: Are there tests for this change?
8. **Breaking changes**: Any API changes that need communication?

## Review Output Format

Structure reviews clearly:

```markdown
## Review Summary

[1-2 sentence overview of the changes and overall assessment]

## Critical Issues 🔴

- [Issue with specific line reference and fix suggestion]

## Important Issues 🟡

- [Issue with context and recommendation]

## Minor Issues 🔵

- [Suggestion for improvement]

## Positive Feedback ✅

- [What's done well]

## Recommendations

[Overall suggestions or next steps]
```

## Review Tips

### Be Constructive

- Frame feedback as questions when uncertain: "Could this cause X if Y happens?"
- Suggest solutions, not just problems
- Acknowledge good code: "Nice use of X pattern here"
- Explain the "why" behind suggestions

### Prioritize

- Focus on high-impact issues first
- Don't nitpick style in critical reviews
- Separate must-fix from nice-to-have
- Consider the scope of changes (minor fix vs major feature)

### Context Matters

- Consider the codebase's existing patterns
- Understand the urgency (hotfix vs planned feature)
- Recognize team conventions may differ from ideal
- Ask clarifying questions if intent is unclear

### Code Review Anti-Patterns to Avoid

- Bikeshedding: Endless debate over trivial matters
- Style crusading: Enforcing personal preferences
- Perfectionism: Blocking reasonable code for minor issues
- Scope creep: Requesting unrelated changes
- Rubber stamping: Approving without actually reviewing

## Language-Specific Guidance

For detailed language-specific patterns, see `references/` directory for:

- JavaScript/TypeScript best practices
- Python idioms and patterns
- Security vulnerability patterns by language
- Web graphics performance (Canvas, WebGL, WebGPU, WebAssembly) - **Use for web app graphics/game performance**

## Common Vulnerability Patterns

### SQL Injection

```python
# ❌ Vulnerable
query = f"SELECT * FROM users WHERE id = {user_id}"

# ✅ Safe
query = "SELECT * FROM users WHERE id = ?"
cursor.execute(query, (user_id,))
```

### XSS (Cross-Site Scripting)

```javascript
// ❌ Vulnerable
element.innerHTML = userInput;

// ✅ Safe
element.textContent = userInput;
// Or use a sanitization library
```

### Path Traversal

```python
# ❌ Vulnerable
with open(f"/uploads/{filename}") as f:
    content = f.read()

# ✅ Safe
from pathlib import Path
safe_path = Path("/uploads").resolve() / filename
if not safe_path.resolve().is_relative_to(Path("/uploads").resolve()):
    raise ValueError("Invalid path")
```

### Command Injection

```javascript
// ❌ Vulnerable
exec(`ffmpeg -i ${userFile} output.mp4`);

// ✅ Safe
execFile('ffmpeg', ['-i', userFile, 'output.mp4']);
```

## Review Workflow

1. **Understand the context**: What problem is being solved?
2. **Review high-level approach**: Is the solution appropriate?
3. **Check security first**: Any vulnerabilities?
4. **Review correctness**: Does the logic work?
5. **Check performance**: Any efficiency issues?
6. **Assess maintainability**: Is it readable and maintainable?
7. **Verify tests**: Are changes tested?
8. **Provide summary**: Categorized feedback with severity
