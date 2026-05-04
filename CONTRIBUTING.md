# Contributing to Agent Checkpoint

We welcome contributions to the Agent Checkpoint project! This document provides guidelines for contributing.

## Development Setup

1. **Prerequisites**
   - Node.js 18+ 
   - pnpm 8+
   - Git

2. **Clone and Setup**
   ```bash
   git clone https://github.com/phoenix-assistant/agent-checkpoint.git
   cd agent-checkpoint
   pnpm install
   ```

3. **Build and Test**
   ```bash
   pnpm build
   pnpm test
   ```

## Project Structure

```
packages/
├── core/           # Core checkpoint engine
├── cli/            # Command line tools  
└── sdk/            # Framework integrations
```

## Making Changes

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow TypeScript strict mode
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   pnpm test
   pnpm lint
   ```

4. **Commit**
   ```bash
   git commit -m "feat: add amazing feature"
   ```
   
   Use conventional commit format:
   - `feat:` new feature
   - `fix:` bug fix
   - `docs:` documentation
   - `test:` tests
   - `refactor:` code refactoring

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## Code Standards

- **TypeScript**: Strict mode enabled, no `any` types
- **Testing**: Vitest with good coverage
- **Linting**: ESLint + Prettier
- **Documentation**: JSDoc comments for public APIs

## Testing Guidelines

- Unit tests for all core functionality
- Integration tests for storage providers
- CLI tests using mocked file system
- Coverage target: 90%+

## Documentation

- Update README for new features
- Add JSDoc comments for public APIs
- Include examples in documentation
- Update CHANGELOG.md

## Questions?

- Open an issue for questions
- Join discussions in GitHub Discussions
- Reach out to maintainers

Thank you for contributing! 🚀