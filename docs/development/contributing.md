# Contributing Guidelines

Thank you for your interest in contributing to the Piper TTS Server! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

Please be respectful and considerate of others when contributing to this project. We aim to foster an inclusive and welcoming community.

## Getting Started

### Prerequisites

- Python 3.8 or higher
- Git
- Piper TTS engine installed

### Setting Up the Development Environment

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/yourusername/piper-tts-server.git
   cd piper-tts-server
   ```
3. Create a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```
4. Install development dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

## Development Workflow

### Branching Strategy

- `main`: The main branch contains the stable code
- `develop`: Development branch for integrating features
- `feature/*`: Feature branches for new features
- `bugfix/*`: Bugfix branches for fixing issues
- `release/*`: Release branches for preparing releases

### Creating a Feature Branch

```bash
git checkout develop
git pull
git checkout -b feature/your-feature-name
```

### Making Changes

1. Make your changes in your feature branch
2. Write or update tests for your changes
3. Run the tests to ensure they pass
4. Update documentation if necessary

### Running Tests

```bash
pytest
```

To run tests with coverage:

```bash
pytest --cov=.
```

### Code Style

We follow PEP 8 style guidelines for Python code. You can check your code style with:

```bash
flake8
```

### Committing Changes

```bash
git add .
git commit -m "Your descriptive commit message"
```

Please use descriptive commit messages that explain what changes were made and why.

### Submitting a Pull Request

1. Push your changes to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
2. Go to the original repository on GitHub
3. Create a pull request from your feature branch to the `develop` branch
4. Describe your changes in the pull request
5. Wait for review and address any feedback

## Project Structure

```
piper-tts-server/
├── .github/            # GitHub workflows and templates
├── docs/               # Documentation
├── models/             # TTS models
├── tests/              # Test files
├── .env.example        # Example environment variables
├── .gitignore          # Git ignore file
├── cache.py            # Cache implementation
├── config.py           # Configuration management
├── requirements.txt    # Python dependencies
├── run.sh              # Server start script
├── test_tts_server.py  # Server tests
└── tts_server.py       # Main server implementation
```

## Adding New Features

When adding new features, please follow these guidelines:

1. **Discuss First**: Open an issue to discuss the feature before implementing it
2. **Keep it Simple**: Start with a minimal implementation and iterate
3. **Write Tests**: Ensure your feature is well-tested
4. **Update Documentation**: Add or update documentation for your feature

## Reporting Bugs

When reporting bugs, please include:

1. A clear description of the bug
2. Steps to reproduce the bug
3. Expected behavior
4. Actual behavior
5. Environment information (OS, Python version, etc.)

## Code Review Process

All pull requests will be reviewed by the maintainers. The review process includes:

1. Checking that the code follows the style guidelines
2. Verifying that tests pass
3. Ensuring documentation is updated
4. Reviewing the implementation for correctness and performance

## Release Process

1. Update version number in `tts_server.py`
2. Update CHANGELOG.md with the changes
3. Create a release branch: `release/vX.Y.Z`
4. Create a pull request to merge into `main`
5. After approval, merge into `main`
6. Tag the release: `git tag vX.Y.Z`
7. Push the tag: `git push origin vX.Y.Z`

## License

By contributing to this project, you agree that your contributions will be licensed under the project's license.