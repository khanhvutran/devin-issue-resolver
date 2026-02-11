# Devin

A web application with a Flask (Connexion) backend and React + TypeScript frontend, using a spec-first approach where the OpenAPI YAML spec is the source of truth.

## Project Structure

```
backend/                  # Python/Flask API (Connexion 3, spec-first)
  openapi/
    openapi.yaml          # OpenAPI spec (source of truth)
  app/
    __init__.py           # App factory (Connexion)
    routes/
  run.py                  # Entry point
  requirements.txt        # Python dependencies

frontend/                 # React + TypeScript (Vite)
  src/
    api-schema.d.ts       # Auto-generated types from OpenAPI spec
    App.tsx               # Main component
  vite.config.ts          # Dev server config (proxies /api to Flask)
```

## Prerequisites

- Python 3.9+
- Node.js (installed via nvm)

## Running the Backend

```bash
cd backend
source venv/bin/activate
python run.py
```

The API runs on http://localhost:5001. Swagger UI docs are at http://localhost:5001/ui/.

## Running the Frontend

```bash
cd frontend
npm run dev
```

The dev server runs on http://localhost:3000 and proxies `/api/*` requests to the backend.

## Development Workflow

### Adding a new backend endpoint

1. Define the endpoint in `backend/openapi/openapi.yaml`:

```yaml
paths:
  /api/users/{user_id}:
    get:
      operationId: app.routes.users.get_user
      summary: Get a user
      parameters:
        - name: user_id
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: Successful response
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/UserOut"

components:
  schemas:
    UserOut:
      type: object
      required:
        - name
      properties:
        name:
          type: string
```

2. Implement the handler in `backend/app/routes/users.py`:

```python
def get_user(user_id):
    return {"name": "Alice"}
```

3. Regenerate the TypeScript types (no running server needed):

```bash
cd frontend
npm run generate-api
```

This reads the OpenAPI spec from `../backend/openapi/openapi.yaml` and writes typed definitions to `src/api-schema.d.ts`. The frontend can then call the new endpoint with full type safety:

```typescript
const { data } = await client.GET('/api/users/{user_id}', {
  params: { path: { user_id: 1 } },
})
// data.name is typed as string
```

### Key files

| File | Purpose |
|---|---|
| `backend/openapi/openapi.yaml` | OpenAPI spec (source of truth for all endpoints) |
| `backend/app/routes/*.py` | Handler functions (referenced by operationId) |
| `backend/app/__init__.py` | App factory -- Connexion setup |
| `frontend/src/api-schema.d.ts` | Auto-generated TS types (do not edit manually) |
| `frontend/vite.config.ts` | Vite dev server and API proxy config |
