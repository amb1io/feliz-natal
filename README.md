# Feliz Natal – SaaS Panel with AWS Cognito Login

This repository contains the Feliz Natal intranet built with **Astro** alongside an **AWS Cognito** setup for Google social sign-in. The goal is to offer a festive dashboard experience while providing a production-ready authentication flow backed by Amazon Cognito.

---

## 📦 Project Structure

```
/
├── public/                  # Static assets
├── src/                     # Astro application (pages, components, data)
│   ├── pages/app/index.astro  # Cognito login screen
│   ├── pages/auth/callback.astro
│   └── ...
├── cognito-template.yaml    # CloudFormation stack for Cognito + IdPs
├── deploy.sh                # Helper script to deploy/update the stack
├── parameters.json          # Example parameter overrides for CloudFormation
├── sample-client.html       # Standalone HTML playground for the Hosted UI
└── README.md
```

---

## 🚀 Astro Front-end

```bash
npm install
npm run dev        # http://localhost:4321
npm run build
npm run preview
```

Key screens:

- `src/pages/app/index.astro` — SaaS login hub that reads Cognito settings from environment variables and redirects users to the Hosted UI with the selected identity provider.
- `src/pages/auth/callback.astro` — Displays the authorization code returned by Cognito and guides the user back to the painel (`/app/painel`). Replace this with custom token exchange logic when you implement your backend.

---

## 🔐 AWS Cognito Social Login

The infrastructure files under the project root configure:

- Cognito User Pool + App Client
- Google Identity Provider wired to the User Pool
- Identity Pool and Hosted UI settings

### 1. Environment Variables

Copy and edit the example file:

```bash
cp .env.example .env
```

The `.env` file contains two sections:

1. **Frontend** (`PUBLIC_COGNITO_*`) used by Astro to build the Hosted UI URLs.
2. **Infrastructure** credentials consumed by `deploy.sh` to provision/update the CloudFormation stack.

Fill in the Google client credentials before deploying.

### 2. Deploy the CloudFormation Stack

```bash
chmod +x deploy.sh
./deploy.sh
```

The script loads variables from `.env`, deploys `cognito-template.yaml`, and prints the resulting stack outputs (User Pool ID, Hosted UI domain, etc.).

### 3. Configure Social Providers

For each provider add the Cognito redirect URI:

```
https://<your-domain>.auth.<region>.amazoncognito.com/oauth2/idpresponse
```

Use the Google section in `.env.example` for detailed pointers to the developer portal. You can expand the template later if you decide to add more providers.

### 4. Configure the Astro App

Set the following keys in `.env` (or your hosting provider secrets):

| Variable | Purpose |
| --- | --- |
| `PUBLIC_COGNITO_DOMAIN` | Cognito Hosted UI domain (sem `https://`), e.g. `feliz-natal-demo.auth.us-east-1.amazoncognito.com` |
| `PUBLIC_COGNITO_CLIENT_ID` | App client ID |
| `PUBLIC_COGNITO_REDIRECT_URI` | Callback route (defaults to `http://localhost:4321/auth/callback`) |
| `PUBLIC_COGNITO_LOGOUT_URI` | Optional logout destination |
| `PUBLIC_COGNITO_REGION` | AWS region (display only) |
| `PUBLIC_COGNITO_SUPPORTED_PROVIDERS` | Comma-separated list of providers to render (`Google` by default) |
| `DATABASE_URL` | Prisma connection string. For local/dev use `file:./prisma/dev.db` (SQLite/D1-compatible). |

Restart `npm run dev` after modifying environment variables.

---

## 🧪 Local Testing Shortcuts

- **Standalone Hosted UI tester:** open `sample-client.html` in the browser to experiment with different providers using only environment values.
- **Callback simulation:** navigate to `http://localhost:4321/auth/callback?code=XYZ` to preview the success state without hitting Cognito.

---

## 📚 Additional Notes

- Do not commit real secrets—keep `.env` out of version control.
- Rotate social app credentials regularly and consider AWS Secrets Manager for production storage.
- O callback (`src/pages/auth/callback.astro`) grava o cookie `felizNatalSession` no navegador. Cada página protegida dentro de `/app/` (exceto o `index.astro`) valida esse cookie no lado do servidor e redireciona visitantes não autenticados de volta para `/app/` antes de renderizar o conteúdo.
- Enhance `src/pages/auth/callback.astro` with server communication to exchange the authorization code for tokens and store sessions securely.
- Remove the `sample-client.html` playground from production builds if not required.

Enjoy building your festive SaaS experience! 🎄
