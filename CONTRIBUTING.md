# Contributing to Tradeflow

We welcome contributions! Whether it's reporting a bug, adding a new feature, or improving documentation, your help is appreciated.

## Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally: `git clone https://github.com/your-username/Tradeflow-v2.git`
3. **Install dependencies**:
   - Backend: `cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
   - Frontend: `cd frontend && npm install`
4. **Copy the environment template**: `cp .env.example .env`
5. **Configure data sources**: Open the application, go to the Settings page, and refer to `DATA_SOURCES.md` to input valid market data URLs.

## Development

You can run the app locally using the provided scripts:
- **Windows**: `start.bat`
- **Linux/Mac**: `./start.sh`

This will spin up both the FastAPI backend and the Vite frontend concurrently.

## Branching Strategy

- **`main`**: Production-ready, stable code. **Direct pushes to `main` are strictly prohibited.**
- **`feature/<name>`**: New user-facing features or major enhancements (e.g. `feature/notifications`).
- **`fix/<name>`**: Bug fixes and security patches (e.g. `fix/setup-guard`).
- **`chore/<name>`**: Refactoring, dependency updates, build tooling, or environment configuration (e.g. `chore/deps-security-fix`).
- **`docs/<name>`**: Documentation improvements (e.g. `docs/branching-strategy`).

## Pull Request Process

1. Create a new topic branch from the latest `main`:
   `git checkout -b <type>/<descriptive-name>`
2. Implement your changes adhering to project guidelines.
3. Commit with Conventional Commit messages (e.g. `feat: ...`, `fix: ...`, `chore: ...`).
4. Push your branch to `origin/<type>/<descriptive-name>`.
5. Open a Pull Request targeting `main`. Ensure all build and verification steps (`npm run build`, python compilation) pass cleanly before merging.

## Code of Conduct

Please be respectful and constructive in all interactions within the repository issues and pull requests.
