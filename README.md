# Iris - Ultra Fast Agentic AI System

## 🚀 Quick Start (5 Minutes)

### Prerequisites
- Docker & Docker Compose
- Supabase account
- OpenAI/Anthropic API keys
- Daytona account

### 1. Clone and Setup
```bash
git clone <your-repo>
cd iris
cp env.example .env
# Edit .env with your API keys
```

### 2. Start All Services
```bash
docker-compose up --build
```

### 3. Access Services
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Mobile**: http://localhost:8081
- **API Docs**: http://localhost:8000/docs

## 🏗️ Architecture

### Services
- **Backend**: FastAPI + Dramatiq worker (Python)
- **Frontend**: Next.js 15 (React)
- **Mobile**: Expo (React Native)
- **Redis**: Message queue for workers
- **Supabase**: Database + Auth + Storage

### Core Tools (6 Essential)
1. **Shell Tool** - Execute commands in Daytona sandbox
2. **File Tool** - Read/write files instantly
3. **Web Search Tool** - Search the web
4. **Browser Tool** - Navigate websites
5. **Code Tool** - Execute code snippets
6. **Computer Tool** - Direct system access

## ⚡ Performance Goals
- **Response Time**: < 200ms
- **Tool Execution**: < 100ms
- **Startup Time**: < 2 seconds
- **Memory Usage**: < 200MB

## 🛠️ Development

### Backend Development
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

### Mobile Development
```bash
cd mobile
npm install
npx expo start
```

## 📁 Project Structure
```
iris/
├── backend/           # FastAPI + Dramatiq worker
├── frontend/          # Next.js app
├── mobile/            # Expo app
├── docs/              # Documentation
├── docker-compose.yml # Multi-service setup
└── env.example        # Environment template
```

## 🎯 Core Philosophy
**Instant Speed, Zero Lag** - Every interaction should feel instantaneous with sub-second response times and real-time tool execution.
