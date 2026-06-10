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

## Pull Request Process

1. Create a new branch for your feature: `git checkout -b feature/your-feature-name`
2. Commit your changes with descriptive messages.
3. Push your branch to your fork.
4. Open a Pull Request against the `main` branch of the upstream repository.
5. Provide a clear description of the problem you're solving and how you've implemented the solution.

## Code of Conduct

Please be respectful and constructive in all interactions within the repository issues and pull requests.
